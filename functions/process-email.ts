import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Event, S3EventRecord } from "aws-lambda";
import { ParsedMail, simpleParser } from "mailparser";
import { Resource } from "sst";
import { Readable } from "stream";
import { extractOriginalMessageId, lambdaLogger } from "./utils";

const logger = lambdaLogger();

// ✅ Initialize AWS Clients with modular SDK (v3)
const s3 = new S3Client();
const ses = new SESClient();
const sqs = new SQSClient();
// const cognito = new CognitoIdentityProviderClient();
const dynamoDB = new DynamoDBClient();

export async function handler(event: S3Event) {
  const record = event.Records[0].s3;
  try {
    logger.debug("Incoming SES email event:", JSON.stringify(event, null, 2));
    // Extract the email from SES event
    const { emailContent, rawEmail } = await extractEmailFromS3(record);

    const targetEmail = (
      Array.isArray(emailContent.to) ? emailContent.to[0] : emailContent.to
    )?.text;
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
        throw `Duplicate found; Ignoring record: ${key}.. `;
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

    await processAttachments(emailContent);
    await moveToPersonalPrefix(key, record);

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

    await deleteRecord(record);

    logger.info(`Stored email to ${key}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Stored email to ${key}` }),
    };
  } catch (e) {
    await deleteRecord(record);
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

export async function streamToString(
  body: GetObjectCommandOutput["Body"]
): Promise<string> {
  if (!body) {
    throw new Error("S3 object body is empty.");
  }

  // If body is already a string or Buffer, return it directly
  if (typeof body === "string") return body;
  if (body instanceof Buffer) return body.toString("utf8");
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  // AWS SDK v3 (Node.js) - Body can be ReadableStream or Readable
  if (body instanceof Readable) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      body.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      body.on("error", reject);
      body.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  // AWS SDK v3 (Browser) - ReadableStream
  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];

    return new Promise<string>((resolve, reject) => {
      function process({ done, value }: ReadableStreamReadResult<Uint8Array>) {
        if (done) {
          resolve(Buffer.concat(chunks).toString("utf8"));
          return;
        }
        chunks.push(value);
        reader.read().then(process).catch(reject);
      }
      reader.read().then(process).catch(reject);
    });
  }

  throw new Error("Unsupported S3 Body type.");
}

// Modify headers without altering body
const modifyHeaders = (
  rawEmail: string,
  {
    newFrom,
    newTo,
    newReturnPath,
  }: { newFrom: string; newTo: string; newReturnPath: string }
) => {
  const lines = rawEmail.split("\n");
  return lines
    .filter((line) => !line.startsWith("DKIM-Signature:"))
    .map((line) => {
      if (line.startsWith("From:")) return `From: ${newFrom}`;
      if (line.startsWith("To:")) return `To: ${newTo}`;
      if (line.startsWith("Return-Path:"))
        return `Return-Path: ${newReturnPath}`;
      return line;
    })
    .join("\n");
};

const deleteRecord = async (record: S3EventRecord["s3"]) => {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: Resource["email-archive-s3"].bucketName,
      Key: record.object.key,
    })
  );

  return {
    status: 200,
    body: JSON.stringify({ message: "Successfully deleted bucket" }),
  };
};

const extractEmailFromS3 = async (record: S3EventRecord["s3"]) => {
  // Extract the email from SES event
  const sesMail = await s3.send(
    new GetObjectCommand({
      Bucket: Resource["email-archive-s3"].bucketName,
      Key: record.object.key,
    })
  );
  if (!sesMail.Body) {
    throw "Missing body - malformed email";
  }
  const rawEmail = await sesMail.Body.transformToString();
  const emailContent = await simpleParser(rawEmail);
  return { emailContent, rawEmail };
};

const getAssociatedUser = async (email: string) => {
  const userRecord = await dynamoDB
    .send(
      new QueryCommand({
        TableName: Resource["users-table"].name,
        IndexName: "appEmailIndex",
        KeyConditionExpression: "app_email = :email",
        ExpressionAttributeValues: {
          ":email": { S: email },
        },
        // AttributesToGet: ["source_emails, email"],
        ProjectionExpression: "source_emails, user_email, user_name",
      })
    )
    .then((res) => {
      if (!res.Items || res.Items?.length === 0) {
        return dynamoDB.send(
          new QueryCommand({
            TableName: Resource["users-table"].name,
            IndexName: "userEmailIndex",
            KeyConditionExpression: "user_email = :email",
            ExpressionAttributeValues: {
              ":email": { S: email },
            },
            // AttributesToGet: ["source_emails, email"],
            ProjectionExpression: "source_emails, user_email, user_name",
          })
        );
      }
      return res;
    });

  return userRecord.Items?.[0];
};

const checkSeenEmailInS3 = async (s3Arn: string) => {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: Resource["email-archive-s3"].bucketName,
        Key: s3Arn,
      })
    );
    return true; // Object exists
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false; // Object does not exist
    }
    throw err; // Some other error (e.g., permissions)
  }
};

const checkSeenEmailInDynamoDB = async (userName: string, s3Arn: string) => {
  return await dynamoDB.send(
    new QueryCommand({
      TableName: Resource["categorized-emails-table"].name,
      IndexName: "userEmails",
      KeyConditionExpression: "user_name = :userName",
      FilterExpression: "s3_arn = :s3Arn",
      ExpressionAttributeValues: {
        ":userName": { S: userName },
        ":s3Arn": { S: s3Arn },
      },
      // AttributesToGet: ["source_emails, email"],
      ProjectionExpression: "source_emails, user_email, user_name",
    })
  );
};

const sendToUserEmail = async (
  targetEmail: string,
  userEmail: string,
  rawEmail: string
) => {
  //use SES to forward the email back.
  const newHeaders = modifyHeaders(rawEmail, {
    newFrom: targetEmail,
    newTo: userEmail,
    newReturnPath: `no-reply@${Resource["consts"].domain}`,
  });
  try {
    const forwardToUser = await ses.send(
      new SendRawEmailCommand({
        Source: targetEmail,
        Destinations: [userEmail], // Ensure SES allows sending here
        RawMessage: { Data: new TextEncoder().encode(newHeaders) },
      })
    );
  } catch (e) {
    logger.error(e);
    if (Resource["App"].stage !== "dev") {
      throw e;
    }
  }
};

const moveToPersonalPrefix = async (
  newKey: string,
  record: S3EventRecord["s3"]
) => {
  try {
    const moveEmail = await s3.send(
      new CopyObjectCommand({
        Bucket: Resource["email-archive-s3"].bucketName,
        CopySource: `${Resource["email-archive-s3"].bucketName}/${record.object.key}`,
        Key: newKey,
      })
    );
    // const removeOriginal = await deleteRecord(record);
  } catch (e) {
    throw `Moving the email in s3 Failed: ${e}`;
  }
};

const processAttachments = async (parsedEmail: ParsedMail) => {
  if (parsedEmail.attachments.length > 0) {
    logger.info(`Found ${parsedEmail.attachments.length} attachments.`);

    for (const attachment of parsedEmail.attachments) {
      if (
        attachment.contentType === "message/rfc822" ||
        attachment.filename?.endsWith(".eml")
      ) {
        logger.info(`Parsing nested .eml file: ${attachment.filename}`);
        // Parse the .eml file recursively
        s3.send(
          new PutObjectCommand({
            Bucket: Resource["email-archive-s3"].bucketName,
            Key: `emails/${attachment.filename}`,
            Body: attachment.content,
          })
        );
      } else {
        logger.info(`Skipping non-.eml attachment: ${attachment.filename}`);
      }
    }
  }
};
