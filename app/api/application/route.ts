import { handlerFactory } from "@/lib/utils";
import { GroupRecord } from "@/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

async function postHandler(req: Request) {
  const { application, deletedApplications } = (await req.json()) as {
    application: Partial<GroupRecord> & { id: string };
    deletedApplications?: string[];
  };

  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  const errors: Error[] = [];

  let responseData = {};

  if (application) {
    const { id, ...changes } = application;

    const updateExpression = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    changes.last_updated = new Date().toISOString();

    for (const key of Object.keys(changes) as (keyof Omit<
      GroupRecord,
      "id"
    >)[]) {
      const value = changes[key];
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }

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

    responseData = { ...responseData, Attributes: response.Attributes };

    if (response.Attributes && application.email_ids) {
      const allEmails = Object.values(application.email_ids).flatMap((
        emails
      ) => {
        return emails;
      });
      const updateEmails = allEmails.map((email) => {
        return docClient
          .send(
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
          )
          .catch((error) => {
            errors.push(error);
            console.error(`Error updating email ${email}:`, error);
          });
      });

      await Promise.all(updateEmails);
    }
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

  if (errors.length > 0) {
    responseData = { ...responseData, errors: errors.map((e) => e.message) };
    console.error("Errors occurred while updating emails:", errors);
    return new Response(
      JSON.stringify({
        message: "Some emails could not be updated.",
        data: responseData,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  return new Response(
    JSON.stringify({
      data: responseData,
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

export async function deleteHandler(req: Request) {
  const { application, cascadeDelete } = (await req.json()) as {
    application: { id: string };
    cascadeDelete?: boolean;
  };
  return deleteApplication({ id: application.id, cascadeDelete });
}

export async function deleteApplication({
  id,
  cascadeDelete = false,
}: {
  id: string;
  cascadeDelete?: boolean;
}) {
  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  const errors: Error[] = [];

  let responseData = {};

  if (!id) {
    throw {
      errorCode: 400,
      message: JSON.stringify({
        message: "Application ID is required for deletion",
        data: responseData,
      }),
    };
  }
  const response = await docClient
    .send(
      new DeleteCommand({
        TableName: Resource["grouped-applications-table"].name,
        Key: {
          id,
        },
        ReturnValues: "ALL_OLD", // return the deleted record
      })
    )
    .catch((error) => {
      errors.push(error);
      console.error(`Error deleting application ${id}:`, error);
    });
  const attributes: Partial<GroupRecord> = response?.Attributes
    ? (response.Attributes as GroupRecord)
    : {};

  if (cascadeDelete && attributes.email_ids) {
    const allEmails = Object.values(attributes.email_ids).flatMap((emails) => {
      return emails;
    });
    const deleteEmails = allEmails.map((email) => {
      return docClient
        .send(
          new DeleteCommand({
            TableName: Resource["categorized-emails-table"].name,
            Key: {
              id: email,
            },
            ReturnValues: "ALL_OLD", // optionally return the updated record
          })
        )
        .catch((error) => {
          errors.push(error);
          console.error(`Error updating email ${email}:`, error);
        });
    });

    await Promise.all(deleteEmails);
  }

  if (errors.length > 0) {
    responseData = { ...responseData, errors: errors.map((e) => e.message) };
    console.error("Errors occurred while deleting emails:", errors);
    throw {
      errorCode: 500,
      message: JSON.stringify({
        message: "Email could not be deleted",
        data: responseData,
      }),
    };
  }

  return new Response(
    JSON.stringify({
      data: responseData,
      message: "Record deleted successfully!",
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
const DELETE = handlerFactory({ methods: ["DELETE"], handler: deleteHandler });
export { DELETE, POST };
