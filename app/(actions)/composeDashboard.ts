"use server";

import { DashboardParams } from "@/types";
import { FetchData } from "../../components/providers/DashboardProvider";
import { composeApplications } from "./composeApplications";
import { composeEmails } from "./compostEmails";

export async function composeDashboardData(
  params: DashboardParams,
  fetchApps?: boolean
): Promise<FetchData> {
  const { emails, chartData } = await composeEmails(params);
  let { records, maxApplications } = fetchApps
    ? await composeApplications(params)
    : { records: [], maxApplications: 0 };
  return {
    emails,
    chartData,
    applications: records,
    maxApplications,
  };
}
