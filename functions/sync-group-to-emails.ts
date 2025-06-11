import { GroupRecord } from "@/types";
import {
  AttributeValue,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";
import { Resource } from "sst";
import { lambdaLogger } from "./utils";

const logger = lambdaLogger();

const dynamo = new DynamoDBClient();

export async function handler(event: DynamoDBStreamEvent) {
  for (const record of event.Records) {
    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;
    let affectedEmails = [];
    if (newImage) {
      const newItem = unmarshall(
        newImage as Record<string, AttributeValue>
      ) as GroupRecord;
      Object.values(newItem.email_ids)
        .flat()
        .forEach(async (email) => {
          logger.info(email);
          return await dynamo
            .send(
              new GetItemCommand({
                TableName: Resource["categorized-emails-table"].name,
                Key: {
                  id: { S: email },
                },
              })
            )
            .then(async (res) => {
              if (!res.Item) {
                return;
              }
              const email = unmarshall(res.Item) as CategorizedEmail;
              email.group_id = newItem.id;
              email.job_title = newItem.job_title ?? email.job_title;
              email.company_title =
                newItem.company_title ?? email.company_title;
              const emailRecord = marshall(email);
              const insertRecord = await dynamo.send(
                new PutItemCommand({
                  TableName: Resource["categorized-emails-table"].name,
                  Item: emailRecord,
                })
              );
            });
        });
    } else if (oldImage) {
      const oldItem = unmarshall(
        oldImage as Record<string, AttributeValue>
      ) as GroupRecord;
      Object.values(oldItem.email_ids)
        .flat()
        .forEach(async (email) => {
          logger.info(email);
          return await dynamo.send(
            new DeleteItemCommand({
              TableName: Resource["categorized-emails-table"].name,
              Key: {
                id: { S: email },
              },
            })
          );
        });
    }
  }
}
