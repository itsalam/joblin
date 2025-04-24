"use server";

import { DashboardParams, GroupRecord } from "@/types";
import { FetchData } from "../(providers)/DashboardProvider";
import { getApplicationData, getFormattedEmails } from "../api/helpers";

export async function composeDashboardData(
  params: DashboardParams,
  fetchApps?: boolean
): Promise<FetchData> {
  const { emails, chartData } = await getFormattedEmails(params);
  let applications: GroupRecord[] | undefined = fetchApps
    ? await getApplicationData(params)
    : undefined;
  return {
    emails,
    chartData,
    applications,
  };
}
