// /pages/api/logo.ts (Next.js API route)
import { extractEmailDataFromString } from "@/functions/utils";
import { handlerFactory } from "@/lib/utils";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";

type LogoDevResult = {
  name: string;
  domain: string;
  logo_url: string;
}[];

const s3 = new S3Client();

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const s3_arn = searchParams.get("s3_arn");

  if (!s3_arn) {
    throw { error: "Missing arn query" };
  }

  const sesMailContent = await s3.send(
    new GetObjectCommand({
      Bucket: Resource["email-archive-s3"].bucketName,
      Key: s3_arn,
    })
  );

  const rawEmail = await sesMailContent.Body!.transformToString();
  const parsedEmail = await extractEmailDataFromString(rawEmail);
  console.log("https://" + Resource["cdn_distribution"].distributionDomainName + "/emails/" + messageId + "/html")
  let html;
  try {
    html = await fetch("https://" + Resource["cdn_distribution"].distributionDomainName + "/emails/" + parsedEmail.id + "/html").then((res) => 
    res.text());
  }  catch (e) {
    console.error("Error fetching HTML:", e);
    html = parsedEmail.html;
  }
  return new Response(
    JSON.stringify({
      email: parsedEmail,
      html
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

const GET = handlerFactory({ methods: ["GET"], handler });
export { GET };
