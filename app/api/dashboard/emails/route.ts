import { authOptions } from "@/lib/auth";
import { DateRanges } from "@/lib/consts";
import { handlerFactory } from "@/lib/utils";
import { ApplicationStatus, DashboardParams } from "@/types";
import { getServerSession } from "next-auth";
import {
  getIntervalDates,
  groupByDateRange,
  searchFromOS,
} from "../../helpers";

import { ResponseError } from "@opensearch-project/opensearch/lib/errors.js";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const dashboardParams = [...searchParams.entries()].reduce<DashboardParams>((
    acc,
    [key, value]
  ) => {
    try {
      acc[key as keyof DashboardParams] = JSON.parse(value);
    } catch (e) {
      acc[key as keyof DashboardParams] = value as any;
    }
    return acc;
  }, {});

  const {
    dateKey = DateRanges.Monthly,
    absolute,
    searchTerm,
    filters,
  } = dashboardParams;

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

  return new Response(
    JSON.stringify({
      emails,
      chartData,
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
