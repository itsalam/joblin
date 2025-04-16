import { cognitoClient } from "@/lib/clients";
import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayEvent } from "aws-lambda";
import { Resource } from "sst";

// ✅ Initialize AWS Clients with modular SDK (v3)
const s3 = new S3Client();
const sqs = new SQSClient();
// const cognito = new CognitoIdentityProviderClient();

export async function handler(event?: APIGatewayEvent) {
  let keys: string[] = JSON.parse(event?.body ?? "").keys ?? []
  const adminUser = await cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: Resource["user-pool"].id,
      Username: "vincentthanhlam@gmail.com",
    })
  );
  if(!keys.length){
    const allEmails = await s3.send(
      new ListObjectsV2Command({
        Bucket: Resource["email-archive-s3"].bucketName,
        Prefix: adminUser.Username,
      })
    );
    keys = allEmails.Contents?.filter((o) => o.Key).map((object) => object.Key as string) ?? []
  } else {
    keys = keys
  }

  Promise.all(
    keys.map(async (key) => {
      const body = JSON.stringify(
        { object_key: key, user_name: adminUser.Username },
        null,
        2
      );

      return sqs.send(
        new SendMessageCommand({
          QueueUrl: Resource["open-api-processing-queue"].url,
          MessageBody: body,
        })
      );
    }) ?? []
  ).catch((error) => {
    console.error(error);
  });
}
