import { openSearchClient } from "@/lib/clients";
import {
  ApplicationStatus,
  FullGroupRecord,
  Group,
  GroupRecord,
  OpenSearchRecord,
} from "@/types";
import {
  BatchGetItemCommand,
  BatchGetItemCommandInput,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Hit } from "@opensearch-project/opensearch/api/_types/_core.search.js";
import { Context, SQSEvent } from "aws-lambda";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";
import { lambdaLogger } from "./utils";

// Initialize OpenSearch Client

const dynamo = new DynamoDBClient();
const logger = lambdaLogger();

export async function handler(event: SQSEvent, context?: Context) {
  try {
    const record = event.Records[0];
    const email = JSON.parse(record.body ?? "") as CategorizedEmail;
    const { groupRecord, insertRecord } = await updateGroup(email);
    return {
      statusCode: 200,
      body: JSON.stringify({ groupRecord, insertRecord }),
    };
  } catch (error) {
    logger.error("Error fetching similar documents:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

export const updateGroup = async (email: CategorizedEmail) => {
  const { company_title, job_title, id, user_name } = email;
  // Extract document ID from the request
  if (!user_name || !company_title || !id) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Missing fields:" + JSON.stringify({ user_name, company_title, id }),
      }),
    };
  }

  const fullGroup = await assignGroup(email);
  if (!fullGroup) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unable to assign group" }),
    };
  }
  const groupRecord = convertToGroupRecord(fullGroup);
  logger.debug({ groupRecord });
  const getPriorGroup = await dynamo
    .send(
      new GetItemCommand({
        TableName: Resource["grouped-applications-table"].name,
        Key: {
          id: { S: groupRecord.id },
        },
      })
    )
    .then((res) => res.Item)
    .catch((err) => {
      logger.error("Error fetching prior group:", err);
      return null;
    });
  let priorGroup: GroupRecord | null = null;
  try {
    priorGroup = getPriorGroup
      ? (unmarshall(getPriorGroup) as GroupRecord)
      : null;
  } catch (error) {
    logger.error({ getPriorGroup, error });
  }

  const email_ids = Object.entries(groupRecord.email_ids).reduce(
    (acc, [key, value]) => {
      acc[key as ApplicationStatus] = value.concat(
        priorGroup?.email_ids[key as ApplicationStatus] ?? []
      );

      return acc;
    },
    {} as Group<ApplicationStatus, CategorizedEmail["id"][]>
  );

  const emails = Object.values(fullGroup.email_ids).flat();
  const newestEmail = emails.reduce((prev, curr) => {
    return new Date(prev.sent_on) > new Date(curr.sent_on) ? prev : curr;
  }, emails[0]);

  const groupRecordItem = marshall({
    ...groupRecord,
    email_ids,
    last_updated: newestEmail.sent_on,
    last_email_subject: newestEmail.subject,
    last_status: newestEmail.application_status,
  } as GroupRecord);

  const insertRecord = await dynamo.send(
    new PutItemCommand({
      TableName: Resource["grouped-applications-table"].name,
      Item: groupRecordItem,
    })
  );

  return { groupRecord, insertRecord };
};

const newGroupFromEmail = (email: CategorizedEmail): FullGroupRecord => {
  const job_title = email.job_title.length > 0 ? email.job_title : uuidv4();
  return {
    id: email.group_id,
    user_name: email.user_name,
    company_title: email.company_title,
    job_title: job_title,
    email_ids: {
      [email.application_status as ApplicationStatus]: email,
    },
  } satisfies FullGroupRecord;
};

const searchOsForSimilarGroups = async (
  baseEmail: CategorizedEmail
): Promise<GroupRecord[] | null> => {
  const { company_title, job_title, id, user_name } = baseEmail;

  const index = `user-${user_name}`;
  const client = await openSearchClient();
  // Step 1: Fetch vector embedding from OpenSearch
  let docResponse;

  try {
    docResponse = await client.get({
      index,
      id,
      _source: ["vector_embedding"],
    });
  } catch (e) {
    throw e;
  }

  if (!docResponse.body._source) {
    throw "Document not found";
  }

  const queryVector = docResponse.body._source.vector_embedding;

  // Step 2: Perform k-NN search using the retrieved vector
  const knnResponse = await client.search({
    index,
    body: {
      size: 5, // Return top 5 similar records
      query: {
        bool: {
          must: [
            {
              knn: {
                vector_embedding: {
                  vector: queryVector,
                  k: 5,
                },
              },
            },
            {
              match: {
                company_title: {
                  query: company_title,
                  minimum_should_match: "95%",
                },
                ...(job_title && {
                  job_title: {
                    query: job_title,
                    minimum_should_match: "90%",
                  },
                }),
              },
            },
          ],
          must_not: [
            { term: { _id: id } }, // Exclude the document by ID
          ],
        },
      },
    },
  });

  // Extract similar documents
  const similarDocs = knnResponse.body.hits.hits.map((hit: Hit) => {
    const { vector_embedding, text, ...source } = hit._source || {};
    return {
      id: hit._id,
      score: hit._score,
      source: source as OpenSearchRecord,
      preview: text?.substring(0, 200),
    };
  });

  if (similarDocs.length === 0) {
    return null;
  }

  if (!similarDocs.every((doc) => doc.source.job_title)) {
    return null;
  }

  const idKeys = Array.from(
    similarDocs.reduce((groups, doc) => {
      groups.add(doc.source.group_id);
      return groups;
    }, new Set<string>())
  );

  return await Promise.all(
    idKeys
      .map(async (idKey) => {
        return dynamo
          .send(
            new QueryCommand({
              TableName: Resource["grouped-applications-table"].name,
              KeyConditionExpression: "id = :id",
              ExpressionAttributeValues: {
                ":id": {
                  S: idKey,
                },
              },
            })
          )
          .then((res) => {
            return (
              (res.Items?.map((item) => unmarshall(item)) as GroupRecord[]) ??
              []
            );
          });
      })
      .flat()
  ).then((res) => res.flat());
};

const assignGroup = async (
  baseEmail: CategorizedEmail
): Promise<FullGroupRecord | null> => {
  const isAmbiguous = baseEmail.job_title.length === 0;
  logger.debug({ baseEmail });
  if (isAmbiguous) {
    logger.info(
      "Unknown job title, searching similar emails for viable groups"
    );
    //search similar emails
    let similarGroups = await searchOsForSimilarGroups(baseEmail);
    if (!similarGroups || similarGroups.length === 0) {
      logger.info(
        "No valid existing group found, search any group with the same company title"
      );
      //  No valid existing group found, search any group with the same company title
      similarGroups = await dynamo
        .send(
          new QueryCommand({
            TableName: Resource["grouped-applications-table"].name,
            IndexName: "companyTitleIndex",
            KeyConditionExpression:
              "company_title = :company_title AND user_name = :user_name",
            ExpressionAttributeValues: {
              ":company_title": {
                S: baseEmail.company_title,
              },
              ":user_name": {
                S: baseEmail.user_name,
              },
            },
          })
        )
        .then(
          (res) =>
            (res.Items?.map((item) => unmarshall(item)) as GroupRecord[]) ?? []
        );
      logger.info(
        "Groups with the same company title: " +
          similarGroups?.map((similarGroups) => similarGroups.id)
      );
    } else {
      logger.info("No Similar groups found");
      logger.debug({ similarGroups });
    }

    if (similarGroups && similarGroups.length) {
      const fullGroupRecords: FullGroupRecord[] = await Promise.all(
        similarGroups.map(convertToFullRecord)
      );

      const validGroup = fullGroupRecords.find((group) =>
        isValidGroup(group, baseEmail));

      logger.debug({ validGroup });
      if (validGroup) {
        validGroup.email_ids[
          baseEmail.application_status as ApplicationStatus
        ] = (
          validGroup.email_ids[
            baseEmail.application_status as ApplicationStatus
          ] ?? []
        ).concat(baseEmail);
        return {
          ...validGroup,
          email_ids: {
            ...validGroup.email_ids,
            [baseEmail.application_status]: baseEmail,
          },
        };
      }
    }

    logger.info(
      "No similar valid emails, preform logic for creating new group"
    );
  }

  if (isAmbiguous) {
    logger.info("Searching for job title...");
  }

  const currGroupReq = !isAmbiguous
    ? await dynamo
        .send(
          new GetItemCommand({
            TableName: Resource["categorized-emails-table"].name,
            Key: {
              id: { S: baseEmail.group_id },
            },
          })
        )
        .then((res) => res.Item)
    : null;

  if (!currGroupReq) {
    logger.info("No groups found.. Creating a new group");

    return newGroupFromEmail(baseEmail);
  } else {
    // Add to existing group
    logger.info("Adding to existing group");
    const currGroup = await convertToFullRecord(
      unmarshall(currGroupReq) as GroupRecord
    );
    if (isValidGroup(currGroup, baseEmail)) {
      const group = newGroupFromEmail(baseEmail);
      const email_ids = Object.entries(currGroup.email_ids).reduce((
        acc,
        [key, value]
      ) => {
        acc[key as ApplicationStatus] = value.concat(
          group?.email_ids[key as ApplicationStatus] ?? []
        );

        return acc;
      }, {} as Group<ApplicationStatus>);
      return {
        ...group,
        email_ids,
      };
    }
  }
  return null;
};

const isValidGroup = (
  groupRecord: FullGroupRecord,
  newEntry?: CategorizedEmail
): boolean => {
  const emailIds = groupRecord.email_ids;
  logger.debug({ group: emailIds });
  if (!emailIds) return false;
  if (newEntry) {
    emailIds[newEntry.application_status as ApplicationStatus] = [newEntry];
  }

  // // Acknowledgement should be sent before any other status
  // const ackdEmails = emailIds[ApplicationStatus.ApplicationAcknowledged];
  // if (
  //   ackdEmails?.length &&
  //   !Object.values(emailIds).every(
  //     (statusEmails) => new Date(email.sent_on) >= new Date(ackdEmail.sent_on)
  //   )
  // ) {
  //   return false;
  // }

  // const rejectEmail = emailIds[ApplicationStatus.Rejected];
  // if (
  //   rejectEmail &&
  //   !Object.values(emailIds).every(
  //     (email) => new Date(email.sent_on) <= new Date(rejectEmail.sent_on)
  //   )
  // ) {
  //   return false;
  // }

  return true;
};

const convertToFullRecord = async (
  groupRecord: GroupRecord
): Promise<FullGroupRecord> => {
  let command;
  let lastItem;
  try {
    const statusEmails = Object.values(groupRecord.email_ids);
    const Keys = [
      ...new Set(statusEmails.flatMap((emails) => emails)).values(),
    ].map((id) => marshall({ id }));
    command = {
      RequestItems: {
        [Resource["categorized-emails-table"].name]: {
          Keys,
        },
      },
    } as BatchGetItemCommandInput;
    const emails = await dynamo.send(new BatchGetItemCommand(command)).then((
      res
    ) => {
      return res.Responses![Resource["categorized-emails-table"].name].map((
        item
      ) => {
        lastItem = item;
        return (unmarshall(item) as CategorizedEmail) ?? [];
      });
    });

    return {
      ...groupRecord,
      email_ids: emails.reduce((acc, email) => {
        const emails = acc[email.application_status as ApplicationStatus] ?? [];
        acc[email.application_status as ApplicationStatus] = [
          ...new Set([...emails, email]),
        ];
        return acc;
      }, {} as Group<ApplicationStatus>),
    } as FullGroupRecord;
  } catch (e) {
    console.trace(JSON.stringify(command, null, 2));
    console.trace(JSON.stringify(lastItem, null, 2));
    logger.error("Error fetching group record:", e);
    throw e;
  }
};

const convertToGroupRecord = (
  fullGroupRecord: FullGroupRecord
): GroupRecord => {
  const email_ids = Object.entries(fullGroupRecord.email_ids).reduce(
    (acc, [key, value]) => {
      let fixedValue = value;
      if (!Array.isArray(fixedValue)) {
        acc[key as ApplicationStatus] = [fixedValue];
        fixedValue = [fixedValue];
      }
      acc[key as ApplicationStatus] = fixedValue.map((email) => email.id);
      return acc;
    },
    {} as Partial<Record<ApplicationStatus, CategorizedEmail["id"][]>>
  );
  return {
    ...fullGroupRecord,
    email_ids,
  };
};
