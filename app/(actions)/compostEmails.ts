"use server";

import { authOptions } from "@/lib/auth";
import { DateRanges } from "@/lib/consts";
import { ApplicationStatus, DashboardParams } from "@/types";
import { ResponseError } from "@opensearch-project/opensearch/lib/errors.js";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { FetchData } from "../../components/providers/DashboardProvider";
import {
  getIntervalDates,
  groupByDateRange,
  searchFromOS,
} from "../api/helpers";

export const composeEmails = cache(async ({
  dateKey = DateRanges.Monthly,
  absolute,
  searchTerm,
  filters,
}: DashboardParams): Promise<FetchData> => {
  const session = await getServerSession(authOptions);

  const dates = getIntervalDates(dateKey, absolute);
  const buckets: Record<
    string,
    Partial<Record<ApplicationStatus, number | null>> & { rawDate: Date }
  > = dates
    .map((date) => date.toISOString().split("T")[0])
    .reduce((curr, timestamp) => ({ ...curr, [timestamp]: {} }), {});

  const seenStatuses = new Set<ApplicationStatus>();
  let res;
  try {
    res = await searchFromOS(session?.user?.username!, {
      filters: filters ?? [],
      searchTerm,
      dateKey,
      absolute: !!absolute,
    });
  } catch (e) {
    console.error({ e, ...((e as ResponseError).meta ?? {}) });
  }

  const hits = res?.hits?.hits ?? [];
  const hitItems: CategorizedEmail[] = hits.map((hit) => {
    return hit._source as CategorizeEmailItem;
  });

  const emails = hitItems;
  emails.sort((a, b) => {
    return new Date(b.sent_on).getTime() - new Date(a.sent_on).getTime();
  });
  emails.forEach((item) => {
    const bucketDate = groupByDateRange(dateKey, item, dates); // YYYY-MM-DD
    const bucketKey = bucketDate.toISOString().split("T")[0];
    const status = item.application_status as ApplicationStatus;
    seenStatuses.add(status);
    if (!buckets[bucketKey]) {
      return;
    }
    if (!buckets[bucketKey]?.rawDate) {
      buckets[bucketKey].rawDate = bucketDate;
    }
    buckets[bucketKey][status] =
      1 +
      (buckets[bucketKey][item.application_status as ApplicationStatus] ?? 0);
  });

  const chartData = Object.entries(buckets).map(([date, statuses], i) => ({
    date,
    rawDate: statuses.rawDate,
    ...Array.from(seenStatuses).reduce(
      (acc, seenStatus) => {
        acc[seenStatus] = statuses[seenStatus] ?? 0;
        return acc;
      },
      {} as Record<ApplicationStatus, number | null>
    ),
  }));

  return { emails, chartData };
});
