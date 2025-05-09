import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { APIGatewayEvent, S3Event } from "aws-lambda";
import { Resource } from "sst";
import { extractOriginalMessageId, lambdaLogger } from "../utils";
import { checkSeenEmailInDynamoDB, checkSeenEmailInS3, deleteRecord, extractEmailFromS3, getAssociatedUser, moveToPersonalPrefix, processAttachments, sendToUserEmail, updateHtmlImages } from "./helpers";

const logger = lambdaLogger();

// ✅ Initialize AWS Clients with modular SDK (v3)
const sqs = new SQSClient();

export async function handler(event: S3Event & APIGatewayEvent) {
  const record = event.Records?.[0]?.s3;
  const objectKey: string = record?.object?.key || JSON.parse(event.body ?? "").key;
  try {
    logger.debug("Incoming SES email event:", JSON.stringify(event, null, 2));
    // Extract the email from SES event
    const { emailContent, rawEmail } = await extractEmailFromS3(objectKey);

    const targetEmail = (
      Array.isArray(emailContent.to) ? emailContent.to[0] : emailContent.to
    )?.value?.[0]?.address;
    const sourceEmail = emailContent.from?.value[0].address;
    //Find the assiociated user from the target email
    if (!targetEmail || !sourceEmail) {
      throw `Malformed email - No 'To' or 'From' header ${{
        To: targetEmail,
        From: sourceEmail,
      }}`;
    }
    const assiocatedUser = await getAssociatedUser(targetEmail);

    if (!assiocatedUser) {
      throw `No user assiociated with the domain name: ${targetEmail}`;
    }

    //query the emails table to see if we've seen this email in S3:
    let messageId = extractOriginalMessageId(emailContent);
    const key = `${assiocatedUser["user_name"].S}/${messageId}`;
    const emailIsInS3 = await checkSeenEmailInS3(key);

    if (emailIsInS3 && assiocatedUser["user_name"].S) {
      const emailDynamoDBObject = await checkSeenEmailInDynamoDB(
        assiocatedUser["user_name"].S,
        key
      );
      if (emailDynamoDBObject.Items?.length) {
        // throw `Duplicate found; Ignoring record: ${key}.. `;
      } else {
        logger.info("S3 record found, but not in DynamoDB");
      }
    }

    if (assiocatedUser && sourceEmail) {
      const sourceEmails: string[] = assiocatedUser["source_emails"].SS ?? [];
      // Send back to user if the To: is not one of their emails, or the From: is not one of their emails
      let sendBackToUser =
        !sourceEmails.includes(targetEmail) &&
        !sourceEmails.includes(sourceEmail);
      const userEmail = assiocatedUser["user_email"].S;

      if (targetEmail && userEmail && sendBackToUser) {
        await sendToUserEmail(targetEmail, userEmail, rawEmail);
      }
    }
    if(true){
      await processAttachments(emailContent);
      await updateHtmlImages(messageId, emailContent)
      await moveToPersonalPrefix(key, objectKey);
    }

    // Send to SQS
    const body = JSON.stringify(
      { object_key: key, user_name: assiocatedUser["user_name"].S },
      null,
      2
    );
    const sendToSQS = await sqs.send(
      new SendMessageCommand({
        QueueUrl: Resource["open-api-processing-queue"].url,
        MessageBody: body,
      })
    );

    await deleteRecord(objectKey);

    logger.info(`Stored email to ${key}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Stored email to ${key}` }),
    };
  } catch (e) {
    await deleteRecord(objectKey);
    logger.error(`Function failed - deleting record: ${e}`);
    logger.error(e);
    throw `Function failed - deleting record: ${e}`;
  } finally {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Handled error, no retry needed" }),
    };
  }
}

