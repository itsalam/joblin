import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PostConfirmationConfirmSignUpTriggerEvent } from "aws-lambda";
import { Resource } from "sst";
import { lambdaLogger } from "./utils";
const dynamoDB = new DynamoDBClient();

const logger = lambdaLogger();

export async function handler(
  event: PostConfirmationConfirmSignUpTriggerEvent
) {
  logger.debug(
    "Incoming Cognito confirmation event:",
    JSON.stringify(event, null, 2)
  );

  const userEmail = event.request.userAttributes.email;
  const userId = event.request.userAttributes.sub; // Cognito User ID
  const emailBase = userEmail.split("@")[0];

  const Item = {
    user_name: {
      S: userId,
    },
    user_email: {
      S: userEmail,
    },
    app_email: {
      S: `${emailBase}@${Resource["consts"].domain}`,
    },
    source_emails: {
      SS: [userEmail],
    },
  };
  try {
    const writeToDB = await dynamoDB.send(
      new PutItemCommand({
        TableName: Resource["users-table"].name,
        Item,
      })
    );
    logger.debug(writeToDB);
    logger.info("Successfully wrote user to table");
  } catch (error) {
    logger.info(error);
  }

  return event;
}
