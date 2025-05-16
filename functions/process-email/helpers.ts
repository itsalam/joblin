import { generateImgproxyUrl } from "@/lib/img-proxy-client";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { SQSClient } from "@aws-sdk/client-sqs";
import imageType from 'image-type';
import { ParsedMail, simpleParser } from "mailparser";
import { Resource } from "sst";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { extractOriginalMessageId, lambdaLogger } from "../utils";

const logger = lambdaLogger();

// ✅ Initialize AWS Clients with modular SDK (v3)
const s3 = new S3Client();
const ses = new SESClient();
const sqs = new SQSClient();
// const cognito = new CognitoIdentityProviderClient();
const dynamoDB = new DynamoDBClient();

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
  
  export const deleteRecord = async (recordKey: string) => {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: Resource["email-archive-s3"].bucketName,
        Key: recordKey,
      })
    );
  
    return {
      status: 200,
      body: JSON.stringify({ message: "Successfully deleted bucket" }),
    };
  };
  
  export const extractEmailFromS3 = async (recordKey: string) => {
    // Extract the email from SES event
    const sesMail = await s3.send(
      new GetObjectCommand({
        Bucket: Resource["email-archive-s3"].bucketName,
        Key: recordKey,
      })
    );
    if (!sesMail.Body) {
      throw "Missing body - malformed email";
    }
    const rawEmail = await sesMail.Body.transformToString();
    const emailContent = await simpleParser(rawEmail);
    return { emailContent, rawEmail, sesMail };
  };
  
  export const getAssociatedUser = async (email: string) => {
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
  
  export const checkSeenEmailInS3 = async (s3Arn: string) => {
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
  
  export const checkSeenEmailInDynamoDB = async (userName: string, s3Arn: string) => {
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
  
  export const sendToUserEmail = async (
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
  
  export const moveToPersonalPrefix = async (
    newKey: string,
    recordKey: string
  ) => {
    try {
      let res; 
      if(recordKey){
        res = await s3.send(
            new CopyObjectCommand({
              Bucket: Resource["email-archive-s3"].bucketName,
              CopySource: `${Resource["email-archive-s3"].bucketName}/${recordKey}`,
              Key: newKey,
            })
          );
      } else {
            throw "No record or content provided for moving email";
        }
        if (!res || res.$metadata.httpStatusCode !== 200) {
          throw "Failed to move email in S3";
        }
      // const removeOriginal = await deleteRecord(record);
    } catch (e) {
      throw `Moving the email in s3 Failed: ${e}`;
    }
  };
  
  export const processAttachments = async (parsedEmail: ParsedMail) => {
    if (parsedEmail.attachments.length > 0) {
      logger.info(`Found ${parsedEmail.attachments.length} attachments.`);
  
      for (const attachment of parsedEmail.attachments) {
        if (
          attachment.contentType === "message/rfc822" ||
          attachment.filename?.endsWith(".eml")
        ) {
          logger.info(`Parsing nested .eml file: ${attachment.filename}`);
          // Parse the .eml file recursively
          const nestedEmail = await simpleParser(attachment.content);
          const messageId = extractOriginalMessageId(nestedEmail);
          s3.send(
            new PutObjectCommand({
              Bucket: Resource["email-archive-s3"].bucketName,
              Key: `emails/${messageId}`,
              Body: attachment.content,
            })
          );
        } else {
          logger.info(`Skipping non-.eml attachment: ${attachment.filename}`);
        }
      }
    }
  };
  
  export const updateHtmlImages = async (messageId: string, parsedEmail: ParsedMail) => {
    const imageSources = parsedEmail.html?extractImageSourcesFromHtml(parsedEmail.html): [];
    const bucketName = Resource["cdn-assets"].bucketName;
    let html = parsedEmail.html || "";
    for (const img of imageSources) {
      let proxyUrl: string | null = null;
      let s3Key: string | null = null;

      try{
        if (img.type === "cid") {
          const cid = img.src.slice(4); // remove "cid:"
          const attachment = parsedEmail.attachments.find(
            (attachment) => attachment.contentId === cid
          );
          if(attachment){
                  const {s3Url} = await uploadRawCidImageToS3({
                      buffer: attachment.content,
                      contentType: attachment.contentType,
                      contentId: cid,
                      messageId,
                      bucketName,
                  })
                  s3Key = `emails/${messageId}/images/${encodeURIComponent(cid)}`;
                  const processedKey = await fetchFromImgproxyAndStore({
                      baseUrl: s3Url,
                      s3Key,
                      bucketName: Resource["cdn-assets"].bucketName,
                      contentType: attachment.contentType,
                  })
                  await deleteRawCIDImage({
                      contentId: cid,
                      messageId,
                      bucketName,
                  })

          }
        } else if (img.type === "external") {
          const url = new URL(img.src);
          const filename = url.pathname.split('/').pop()?.split("?").shift() || uuidv4();
          s3Key = `emails/${messageId}/images/${encodeURIComponent(filename)}`;
          await fetchFromImgproxyAndStore({
              baseUrl: img.src,
              s3Key,
              bucketName,
          })
        } else if (img.type === "data") {
          const [metadata, base64Data] = img.src.split(',');
          const mimeMatch = metadata.match(/data:(.*);base64/);
          if (!mimeMatch) {
            throw new Error('Invalid Data URI format');
          }
          const mimeType = mimeMatch[1];
          const buffer = Buffer.from(base64Data, 'base64');
          s3Key = `emails/${messageId}/images/${encodeURIComponent(uuidv4())}`;
          await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: mimeType,
              })
            );

        }
      }
      catch(e){
          logger.error(`Error uploading image to S3: ${JSON.stringify({messageId, src: img.src, }, null, 2)}`);
          logger.error(e);
                  logger.warn(`No S3 key found for image: ${JSON.stringify(img)}`);
        logger.info(`Replacing ${img.src} with local static img`);
        html = html.replace(img.tagHtml, "/images/placeholder.png");
      }
      if (s3Key) {
        proxyUrl = Resource["cdn_distribution"].distributionDomainName + "/" + s3Key;
        html = html.replace(img.src, proxyUrl);
      }
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: `emails/${messageId}/html`,
        Body: html,
      })
    );

    return html;
  }
  
  type EmailImageSource = {
    type: "cid" | "data" | "external";
    src: string;
    tagHtml: string;
  };
  
export function extractImageSourcesFromHtml(html: string): EmailImageSource[] {
    const imgSrcRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    const results: EmailImageSource[] = [];
    let match;
    while ((match = imgSrcRegex.exec(html)) !== null) {
      const src = match[1];
      const tagHtml = match[0];
  
      const type = src.startsWith("cid:")
        ? "cid"
        : src.startsWith("data:")
        ? "data"
        : src.startsWith("http://") || src.startsWith("https://")
        ? "external"
        : null;
  
      if (type) {

        results.push({ type, src, tagHtml });
    }
  
  }
  return results;
}
  
  async function uploadRawCidImageToS3({
    buffer,
    contentType,
    contentId,
    messageId,
    bucketName,
  }: {
    buffer: Buffer;
    contentType: string;
    contentId: string;
    messageId: string;
    bucketName: string;
  }) {
    const key = `emails/${messageId}/raw/${encodeURIComponent(contentId)}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { s3Key: key, s3Url: `s3://${bucketName}/${key}` };
  }

  export async function fetchFromImgproxyAndStore({
    baseUrl,
    s3Key,
    bucketName,
    contentType
  }: {
    baseUrl: string;
    s3Key: string;
    bucketName: string;
    contentType?: string;
  }) {

    const imgproxyUrl = generateImgproxyUrl(baseUrl);
    const res = await fetch(imgproxyUrl);
  
    if (!res.ok) {
      throw new Error(`Failed to fetch from imgproxy: ${res.status} ${res.statusText} ${imgproxyUrl} ${baseUrl}`);
    }
  
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    contentType = res.headers.get("Content-Type") || (await imageType(buffer))?.mime;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  
    return `s3://${bucketName}/${s3Key}`;
  }

  async function deleteRawCIDImage({
    contentId,
    messageId,
    bucketName,
  }: {
    contentId: string;
    messageId: string;
    bucketName: string;
  }) {
    const key = `emails/${messageId}/raw/${encodeURIComponent(contentId)}`;
    return s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  }