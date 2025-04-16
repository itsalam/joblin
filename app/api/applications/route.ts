import { authOptions } from "@/lib/auth";
import { handlerFactory } from "@/lib/utils";
import { GroupRecord } from "@/types";
import {
  BatchGetItemCommand,
  BatchGetItemInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getServerSession } from "next-auth";
import { Resource } from "sst";
import { getFormattedEmails } from "../helpers";

const dbClient = new DynamoDBClient({ region: "us-east-1" });

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateRangeParam = searchParams.get("dateRange") ?? undefined;
  const absolute = !!searchParams.get("absolute");
  const session = await getServerSession(authOptions);
  const username = session?.user?.username!;

  const { emails, chartData } = await getFormattedEmails({
    dateRangeParam,
    absolute,
  });

  const groupIds = Array.from(new Set(emails.map((emails) => emails.group_id)));
  let queryCommand: BatchGetItemInput = {
    RequestItems: {
      [Resource["grouped-applications-table"].name]: {
        Keys: groupIds.map((id) => ({
          id: { S: id }, // your sort key or unique key
        })),
      },
    },
  };
  let results: GroupRecord[] = [];
  await dbClient.send(new BatchGetItemCommand(queryCommand)).then(
    (res) => {
      const entries = Object.values(res.Responses ?? {})[0] ?? [];
      results = entries.map((entry) =>
        typeof entry === "string" ? entry : (unmarshall(entry) as GroupRecord));
    },
    (rej) => console.log({ rej })
  );

  results = results.map((groupRecord) => {
    return {
      ...groupRecord,
      last_email_subject: emails.find(
        (email) => email.group_id === groupRecord.id
      )?.subject,
    };
  });

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const GET = handlerFactory({ methods: ["GET"], handler });
export { GET };
