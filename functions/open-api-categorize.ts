import { SQSEvent, SQSHandler } from "aws-lambda";

import {
  ApplicationStatus,
  OpenAIResult,
  ParsedEmailContent,
  UserRecord,
} from "@/types";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import OpenAI from "openai";
import pRetry from "p-retry";
import { Resource } from "sst";
import { v4 as uuidv4 } from "uuid";
import { extractEmailDataFromString, lambdaLogger } from "./utils";

export const OpenAIJSONSchema = {
  type: "object",
  properties: {
    is_job_application: {
      type: "boolean",
      description:
        "Whether or not the text found pertains to a job application(s) and the various stages throughout the screening process.",
    },
    applications: {
      type: "array",
      items: {
        $ref: "#/$defs/application",
      },
      description:
        "An array of job applications updates found in the text. Each update contains the company name, job title, confidence score, and application status. If the text does not pertain to a job application, return an empty array.",
    },
    $defs: {
      application: {
        type: "object",
        properties: {
          company_title: { type: "string" },
          job_title: {
            type: "string",
            description:
              'The title of the job that the candidate is applying for. If the job title has any identifying or unique IDs associated with it, include it. If the job title is not found, return an empty string. i.e ""',
          },
          confidence: {
            type: "number",
            description:
              "The confidence that the given information pertains to a candidate's job application",
          },
          application_status: {
            type: "string",
            enum: Object.values(ApplicationStatus),
          },
        },
        required: [
          "job_title",
          "company_title",
          "confidence",
          "application_status",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["is_job_application", "applications"],
};

const logger = lambdaLogger();
const sqs = new SQSClient({});

export const handler: SQSHandler = async (event: SQSEvent) => {
  logger.debug("Received SQS Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const s3 = new S3Client({});
      const dynamoDB = new DynamoDBClient({});
      // ✅ Parse the message body (assuming it's JSON)
      const { object_key: emailKey, user_name } = JSON.parse(record.body) as {
        object_key: string;
        user_name: string;
      };
      const sesMailContent = await s3.send(
        new GetObjectCommand({
          Bucket: Resource["email-archive-s3"].bucketName,
          Key: emailKey,
        })
      );
      const userRecord = await dynamoDB.send(
        new GetItemCommand({
          TableName: Resource["users-table"].name,
          Key: {
            user_name: { S: user_name },
          },
          ProjectionExpression: "source_emails, user_email",
        })
      );
      if (!userRecord.Item) {
        logger.error("User not found in database");
        continue;
      }
      const user = unmarshall(userRecord.Item) as UserRecord;
      const rawEmail = await sesMailContent.Body!.transformToString();
      const { id: messageId, ...parsedEmail } =
        await extractEmailDataFromString(rawEmail, user.source_emails);

      const alreadyWrittenToDB = await dynamoDB.send(
        new GetItemCommand({
          TableName: Resource["categorized-emails-table"].name,
          Key: {
            id: { S: messageId },
          },
        })
      );

      if (alreadyWrittenToDB.Item) {
        logger.info("Email already processed, skipping...");
        continue;
      }

      const categorizedMessage = await categorizeMessage(parsedEmail);

      logger.debug("📩 Processed Message:", parsedEmail);
      logger.debug(categorizedMessage);
      logger.info("Writing results to table...");
      if (categorizedMessage?.is_job_application) {
        for (const application of categorizedMessage.applications) {
          const { job_title, company_title, confidence, application_status } =
            application;

          const categorizedEmail: CategorizedEmail = {
            user_name,
            id: messageId + uuidv4().slice(0, 8),
            confidence: confidence,
            company_title: company_title,
            application_status: application_status,
            job_title: job_title,
            group_id: uuidv4(),
            s3_arn: emailKey,
            sent_on:
              parsedEmail.date?.toISOString() ?? new Date().toISOString(),
            preview: parsedEmail.preview,
            subject: parsedEmail.subject,
            from: parsedEmail.from,
          };
          console.log({ categorizedEmail });
          const Item = marshall(categorizedEmail) as CategorizeEmailItem;

          try {
            logger.info("Writing to database...");
            const writeToDB = await dynamoDB.send(
              new PutItemCommand({
                TableName: Resource["categorized-emails-table"].name,
                Item,
              })
            );
            logger.debug({ writeToDB });
            logger.info("Writing to grouping queue...");
            const sendToGroupingQueue = await sqs.send(
              new SendMessageCommand({
                QueueUrl: Resource["grouping-queue"].url,
                MessageBody: JSON.stringify(categorizedEmail),
              })
            );
          } catch (error) {
            logger.error(error);
          }
        }
      } else {
        logger.info("Email registered as not an application, skiping...");
      }

      // ✅ Add your processing logic here
      // Example: Send an email, write to a database, etc.
    } catch (error) {
      logger.error("❌ Error processing SQS message:", error);
    }
  }
};

async function categorizeMessage(
  message: ParsedEmailContent
): Promise<OpenAIResult | null> {
  if (process.env.DRY_RUN === "1") {
    return {
      is_job_application: true,
      applications: [
        {
          job_title: "Software Developer - Design Systems",
          company_title: "Googler",
          confidence: 0.95,
          application_status: ApplicationStatus.ApplicationAcknowledged,
        },
      ],
    };
  }

  try {
    const results = await getAssistantCompletion(message);
    return results;
  } catch (e) {
    console.error(e);
    return null;
  }
}

const getAssistantCompletion = async (message: ParsedEmailContent) => {
  const client = new OpenAI({
    apiKey: Resource["OpenApiKey"].value, // This is the default and can be omitted
  });

  const chatCompletion = await pRetry(async () =>
    client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `- **Do not return any extra text.** Output only the JSON.
- As an email classifier, when given an email's content, preform the following steps:

### **Step 1: Determine Relevance**
- Identify if the email pertains to a **job application process**.
- Return a **confidence score** between **0 and 1**.

---

### **Step 2: Extract Key Information**
- Extract **Company Name** and **Job Title**.
- If the **Job Title** has any identifying or unique IDs associated with it, include it.
- Some email's content may contain multiple applications and their ongoing status, in this case, include them with their own confidence rating.

---

### **Step 3: Classify Application Status**
- Assign one of the following **status labels**:
  - **ACK** → Acknowledgment of application, usually an automated message.
  - **PROCEED** → Next step discussion, usually a non-automated message.
  - **INTERVIEW** → Explicitly requested an interview.
  - **OFFER** → Extends a job offer.
  - **ACCEPTED** → Candidate accepted the offer.
  - **REJECTED** → Rejection notice.

---

### **Step 4: Ensure JSON Output**
- The response **must be structured in JSON format** as follows:
{
  "is_job_application": true,
  "applications": [
    "company_title": "Google",
    "job_title": "Software Engineer",
    "confidence": 0.92,
    "application_status": "INTERVIEW"
  ]
}`,
        },
        { role: "user", content: JSON.stringify(message) },
      ],
      tools: [
        {
          type: "function",
          function: {
            description: "Inserts the job application data in the database.",
            name: "InsertJobData",
            parameters: OpenAIJSONSchema,
          },
        },
      ],
      tool_choice: "required",
      model: "gpt-4o",
    }));

  // If the message content is available, parse it
  return JSON.parse(
    chatCompletion.choices[0].message.tool_calls?.[0].function.arguments
      .replace("```", "")
      .replace("json", "") ?? ""
  ) as OpenAIResult;
};
