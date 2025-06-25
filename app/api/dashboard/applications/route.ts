"use server";

import { handlerFactory } from "@/lib/utils";
import { GroupRecord } from "@/types";
import {
  BatchGetItemCommand,
  BatchGetItemInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

async function handler(req: Request) {
  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  let records: GroupRecord[] = [];

  const body = (await req.json()) as { emailIds: string[] };
  const { emailIds } = body;

  if (emailIds.length) {
    let queryCommand: BatchGetItemInput = {
      RequestItems: {
        [Resource["grouped-applications-table"].name]: {
          Keys: emailIds.map((id) => ({
            id: { S: id }, // your sort key or unique key
          })),
        },
      },
    };
    await dbClient.send(new BatchGetItemCommand(queryCommand)).then((res) => {
      const entries = Object.values(res.Responses ?? {})[0] ?? [];
      records = entries.map((entry) =>
        typeof entry === "string" ? entry : (unmarshall(entry) as GroupRecord));
    });
  }

  return new Response(
    JSON.stringify({
      records,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

const POST = handlerFactory({ methods: ["POST"], handler });
export { POST };
