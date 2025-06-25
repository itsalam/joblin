import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { Readable } from "stream";

const s3 = new S3Client({});
const dbClient = new DynamoDBClient({ region: "us-east-1" });

const bucketName = Resource["email-archive-s3"].bucketName;
const s3Folder = "b4881488-6011-7094-4231-99f95f37fc1e/";
function isReadableStream(body: unknown): body is Readable {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Readable).read === "function" &&
    typeof (body as Readable).on === "function"
  );
}
// Helper to stream body to string/buffer
const streamToBuffer = (stream: Readable): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

async function main() {
  // const email = s3.send(
  //   new GetObjectCommand({
  //     Bucket: "email-archive-423623864572",
  //     Key: "emails/CAH=hoMz9YUH8cBQj1hfvk+8uSNsEiU8ghEvafH-ZLWjvgcUujQ_mail_gmail_com",
  //   })
  // );
  // const response = await s3.send(new ListObjectsV2Command({
  //   Bucket: bucketName,
  //   Prefix: s3Folder
  // }))
  // const objects = response.Contents ?? [];
  // const results = await Promise.all(
  //   objects.map(async (obj) => {
  //     let body: Buffer;
  //     let error: Error | null = null;
  //     let html: string | null = null;
  //     try {
  //       const getCommand = new GetObjectCommand({
  //         Bucket: bucketName,
  //         Key: obj.Key,
  //       });
  //       const data = await s3.send(getCommand);
  //       const bodyBuffer = data.Body
  //       if (!bodyBuffer || !isReadableStream(bodyBuffer)) {
  //         throw new Error("No body");
  //       }
  //       body = await streamToBuffer(bodyBuffer);
  //       const email = await simpleParser(body);
  //       const messageId = extractOriginalMessageId(email);
  //       html = await updateHtmlImages(messageId, email);
  //     } catch (e) {
  //       console.error(`Error processing object ${obj.Key}:`, e);
  //       error = e as Error;
  //     }
  //     return {
  //       key: obj.Key,
  //       // content: body?.toString(), // Use body.toString() if it's text
  //       html,
  //       error
  //     };
  //   })
  // );
  // results.forEach((result) => {
  //   if (result.error) {
  //     console.error(`Error processing ${result.key}:`, result.error);
  //   }
  // });
}

main();
