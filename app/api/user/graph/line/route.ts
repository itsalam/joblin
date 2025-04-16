import { fetchEmails, getIntervalDates, groupByDateRange } from "@/app/api/helpers";
import { authOptions } from "@/lib/auth";
import { DateRanges } from "@/lib/consts";
import { handlerFactory } from "@/lib/utils";
import { ApplicationStatus } from "@/types";
import { getServerSession } from "next-auth";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateRange = searchParams.get("dateRange");
  const absolute = !!searchParams.get("absolute");
  const session = await getServerSession(authOptions);
  const dateRangeKey =
    DateRanges[dateRange as keyof typeof DateRanges] ?? DateRanges.Monthly;

  const dates = getIntervalDates(dateRangeKey, absolute);
  const buckets: Record<
    string,
    Partial<Record<ApplicationStatus, number | null>> & { rawDate: Date }
  > = dates.map((date) => date.toISOString().split("T")[0]).reduce(
    (curr, timestamp) => ({ ...curr, [timestamp]: {} }),
    {}
  );

  const seenStatuses = new Set<ApplicationStatus>();

  const emails = await fetchEmails(session?.user?.username!, [dates[0], dates[dates.length - 1]]);
  emails.sort((a, b) => {
    return new Date(a.sent_on).getTime() - new Date(b.sent_on).getTime();
  });
  emails.forEach((item) => {
    const bucketDate = groupByDateRange(dateRangeKey, item, dates); // YYYY-MM-DD
    const bucketKey = bucketDate.toISOString().split("T")[0];
    const status = item.application_status as ApplicationStatus;
    seenStatuses.add(status);
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
    ...Array.from(seenStatuses).reduce((acc, seenStatus) => {
      acc[seenStatus] = statuses[seenStatus] ?? 0;
      return acc;
    }, {} as Record<ApplicationStatus, number | null>),
  }));

  console.log({chartData, buckets, dates});
  return new Response(
    JSON.stringify({
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
