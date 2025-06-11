import { handlerFactory } from "@/lib/utils";
import { GroupRecord } from "@/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

async function postHandler(req: Request) {
  const { application, deletedApplications } = (await req.json()) as {
    application: Partial<GroupRecord> & { id: string };
    deletedApplications?: string[];
  };
  const { id, ...changes } = application;

  const updateExpression = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  for (const key of Object.keys(changes) as (keyof Omit<GroupRecord, "id">)[]) {
    const value = changes[key];
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  }

  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  const response = await docClient.send(
    new UpdateCommand({
      TableName: Resource["grouped-applications-table"].name,
      Key: {
        id,
      },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW", // optionally return the updated record
    })
  );

  if (response.Attributes && application.email_ids) {
    const allEmails = Object.values(application.email_ids).flatMap((emails) => {
      return emails;
    });
    const updateEmails = allEmails.map((email) => {
      return docClient.send(
        new UpdateCommand({
          TableName: Resource["categorized-emails-table"].name,
          Key: {
            id: email,
          },
          UpdateExpression: `SET #group_id = :group_id`,
          ExpressionAttributeNames: {
            "#group_id": "group_id",
          },
          ExpressionAttributeValues: {
            ":group_id": id,
          },
          ReturnValues: "ALL_NEW", // optionally return the updated record
        })
      );
    });

    await Promise.all(updateEmails);
  }

  if (deletedApplications && deletedApplications.length > 0) {
    const deleteRequests = deletedApplications.map((id) => ({
      DeleteRequest: {
        Key: { id },
      },
    }));
    const BATCH_SIZE = 25; // DynamoDB batch write limit
    for (let i = 0; i < deleteRequests.length; i += BATCH_SIZE) {
      const batch = deleteRequests.slice(i, i + BATCH_SIZE);
      const params = {
        RequestItems: {
          [Resource["grouped-applications-table"].name]: batch,
        },
      };

      await docClient.send(new BatchWriteCommand(params));
    }
  }

  return new Response(
    JSON.stringify({
      data: response.Attributes,
      message: "Record updated successfully!",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

const POST = handlerFactory({ methods: ["POST"], handler: postHandler });
export { POST };
