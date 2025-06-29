import { openSearchClient } from "@/lib/clients";
import { OpenSearchRecord } from "@/types";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";
import OpenAI from "openai";
import { Resource } from "sst";
import { encoding_for_model, TiktokenModel } from "tiktoken";
import { extractEmailDataFromString, lambdaLogger } from "./utils";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "@opensearch-project/opensearch";

const logger = lambdaLogger();

const VECTOR_DIMENSIONS = 1536;
const MAX_TOKENS = 8192;
const EMBEDDING_MODEL = "text-embedding-3-small";
const s3 = new S3Client({});
const osClient = await openSearchClient();

export async function handler(event: DynamoDBStreamEvent) {
  for (const record of event.Records) {
    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;

    const oldItem: CategorizedEmail | null = oldImage
      ? (unmarshall(
          record.dynamodb?.OldImage as Record<string, AttributeValue>
        ) as CategorizedEmail)
      : null;
    if (newImage) {
      const newItem = unmarshall(
        newImage as Record<string, AttributeValue>
      ) as CategorizedEmail;
      try {
        upsertOpenSearchEmailItem(newItem, !!oldItem);
        logger.info(`Updated document ${newItem.id} in OpenSearch.`);
      } catch (error) {
        console.error(`Failed to update document ${newItem.id}:`, error);
      }
    } else if (oldItem) {
      try {
        const index = `user-${oldItem.user_name}`;
        const checkItem = await osClient.exists({ index, id: oldItem.id });
        if (!checkItem.body) {
          logger.info(`Index ${index} does not exist in OpenSearch.`);
          continue;
        } else {
          logger.info(`Deleting document ${oldItem.id} from OpenSearch.`);
          await osClient.delete({
            index: `user-${oldItem.user_name}`,
            id: oldItem.id,
          });
          logger.info(`Deleted document ${oldItem.id} from OpenSearch.`);
        }
      } catch (error) {
        console.error(`Failed to delete document ${oldItem.id}:`, error);
      }
    }
  }
}

export const upsertOpenSearchEmailItem = async (
  item: CategorizedEmail,
  update?: boolean
) => {
  try {
    // Step 1: Fetch existing document (to preserve vector_embedding)
    let existingDocument;
    const index = `user-${item.user_name}`;
    const id = item.id;
    await ensureIndexExists(index, item);
    const checkDocument = await osClient.exists({ index, id });
    const documentExists = checkDocument.body;
    if (!documentExists) {
      logger.info(`Creating document ${item.id}.`);
      const sesMailContent = await s3.send(
        new GetObjectCommand({
          Bucket: Resource["email-archive-s3"].bucketName,
          Key: item.s3_arn,
        })
      );
      const rawEmail = await sesMailContent.Body!.transformToString();
      const parsedEmail = await extractEmailDataFromString(rawEmail);

      const recordContent: OpenSearchRecord = {
        ...item,
        text: parsedEmail.text,
      };

      await createEmbedding(recordContent);
    }

    if (update) {
      existingDocument = (
        await osClient.get({
          index,
          id,
        })
      ).body._source;

      const updatedDocument = {
        ...item,
        vector_embedding: existingDocument?.vector_embedding || [], // Preserve embedding
      };

      // Step 3: Update OpenSearch with merged data
      await osClient.update({
        index,
        id,
        body: {
          doc: updatedDocument,
          doc_as_upsert: true, // Create if it doesn't exist
        },
      });
    }
  } catch (error) {
    console.error(`Failed to update document ${item.id}:`, error);
  }
};

const ensureIndexExists = async (index: string, item: CategorizedEmail) => {
  const checkIndexResp = await osClient.indices.exists({ index });
  const indexExists = checkIndexResp.body;
  if (!indexExists) {
    logger.info(
      `Document ${item.id} not found in OpenSearch. Creating index..`
    );

    await createEmbeddingIndex({ index, client: osClient });
    logger.info(`Index created for ${item.user_name}`);
  }
};

const createEmbedding = async (record: OpenSearchRecord) => {
  const openAi = new OpenAI({
    apiKey: Resource["OpenApiKey"].value, // This is the default and can be omitted
  });

  try {
    let input = JSON.stringify(record);
    if (countTokens(input) > MAX_TOKENS) {
      input = truncateText(input);
    }

    const embedding = await openAi.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });

    const index = `user-${record.user_name}`;

    const addIndex = await osClient.index({
      id: record.id,
      index,
      body: {
        ...record,
        vector_embedding: embedding.data[0].embedding,
      },
      refresh: true, // Ensures immediate availability in search results
    });
    if (!addIndex.statusCode || addIndex.statusCode >= 400) {
      throw addIndex.body;
    }
  } catch (error) {
    console.error("❌ Error processing embedding messages:", error);
    console.error({ emailContent: record });
    throw error;
  }
};

const createEmbeddingIndex = async ({
  index,
  client,
}: {
  index: string;
  client: Client;
}) => {
  logger.info(`Creating index: ${index}`);
  const res = await client.indices.create({
    index,
    body: {
      settings: {
        index: {
          knn: true, // Enables k-NN search
        },
      },
      mappings: {
        properties: {
          vector_embedding: {
            type: "knn_vector",
            dimension: VECTOR_DIMENSIONS,
            method: {
              name: "hnsw", // 🔹 Hierarchical Navigable Small World graph
              space_type: "cosinesimil", // 🔹 Cosine similarity for OpenAI embeddings
              engine: "nmslib", // 🔹 Engine for fast k-NN search
            },
          },
          job_title: { type: "text" },
          company: { type: "text" },
          from: { type: "keyword" },
          subject: { type: "text" },
          date: { type: "date" },
        },
      },
    },
  });
  if (res.statusCode && res.statusCode < 400) {
    logger.info("Index created");
  } else {
    throw res.warnings;
  }
};

export const countTokens = (
  text: string,
  model: TiktokenModel = EMBEDDING_MODEL
): number => {
  const encoder = encoding_for_model(model);
  return encoder.encode(text).length;
};

export const truncateText = (
  text: string,
  maxTokens = MAX_TOKENS,
  model: TiktokenModel = EMBEDDING_MODEL
): string => {
  const encoder = encoding_for_model(model);
  const tokens = encoder.encode(text);

  if (tokens.length > maxTokens) {
    logger.warn(
      `Truncating text: ${tokens.length} tokens -> ${maxTokens} tokens`
    );
  }

  return new TextDecoder().decode(Uint8Array.from(tokens.slice(0, maxTokens)));
};
