"use server";

import { MAX_APPLICATION_PAGE_SIZE } from "@/lib/consts";
import { DashboardParams, GroupRecord } from "@/types";
import {
  BatchGetItemCommand,
  BatchGetItemInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { composeEmails } from "./compostEmails";

export const composeApplications = async (
  params: DashboardParams
): Promise<{
  records: GroupRecord[];
  currPage: number;
  maxApplications: number;
}> => {
  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  let results: GroupRecord[] = [];

  const { emails } = await composeEmails(params);
  const pageIndex = params.applicationPageIndex ?? 0;

  const groupIds = Array.from(new Set(emails.map((emails) => emails.group_id)));

  const firstIndex = pageIndex * MAX_APPLICATION_PAGE_SIZE;
  const lastIndex = Math.min(
    (pageIndex + 1) * MAX_APPLICATION_PAGE_SIZE + 1,
    groupIds.length
  );
  console.log(firstIndex, lastIndex, groupIds.length);
  const fetchingIds = groupIds.slice(firstIndex, lastIndex);

  if (fetchingIds.length) {
    let queryCommand: BatchGetItemInput = {
      RequestItems: {
        [Resource["grouped-applications-table"].name]: {
          Keys: fetchingIds.map((id) => ({
            id: { S: id }, // your sort key or unique key
          })),
        },
      },
    };
    await dbClient.send(new BatchGetItemCommand(queryCommand)).then(
      (res) => {
        const entries = Object.values(res.Responses ?? {})[0] ?? [];
        results = entries.map((entry) =>
          typeof entry === "string"
            ? entry
            : (unmarshall(entry) as GroupRecord));
      },
      (rej) => console.error({ rej })
    );
  }
  return {
    records: results,
    currPage: pageIndex,
    maxApplications: groupIds.length,
  };
};
