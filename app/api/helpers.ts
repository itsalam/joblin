import { openSearchClient } from "@/lib/clients";
import { DateRange, DateRanges } from "@/lib/consts";
import { DashboardParams, FilterType, OpenSearchRecord } from "@/types";
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  MatchQuery,
  QueryContainer,
} from "@opensearch-project/opensearch/api/_types/_common.query_dsl.js";
import { Search_RequestBody } from "@opensearch-project/opensearch/api/index.js";
import { cache } from "react";
import { Resource } from "sst";

const dbClient = new DynamoDBClient({ region: "us-east-1" });

let cachedData: Map<string, { expiry: number; payload: CategorizedEmail[] }> =
  new Map();
let cacheExpiry = 0;

export const fetchRelevantEmails = async (
  username: string,
  applicationId: string,
  dateRange?: Date[]
): Promise<CategorizedEmail[]> => {
  const cacheKey = `${applicationId}-${dateRange?.[0]?.toISOString()}-${dateRange?.[1]?.toISOString()}`;
  const now = Date.now();
  const cacheRes = cachedData.get(cacheKey);
  if (cacheRes && now < cacheRes.expiry) {
    return cacheRes.payload;
  }
  let ExpressionAttributeValues: QueryCommandInput["ExpressionAttributeValues"] =
    {
      ":user_name": {
        S: username,
      },
    };

  if (applicationId) {
    ExpressionAttributeValues[":group_id"] = {
      S: applicationId,
    };
  }

  let queryCommand: QueryCommandInput = {
    TableName: Resource["categorized-emails-table"].name,
    IndexName: applicationId ? "groupIdIndex" : "userEmails",
    KeyConditionExpression: `user_name = :user_name${applicationId ? " AND group_id = :group_id" : ""} `,
    ExpressionAttributeValues,
  };

  if (dateRange) {
    const [before, after] = [
      dateRange[0].toISOString(),
      dateRange[dateRange.length - 1].toISOString(),
    ];
    ExpressionAttributeValues = {
      ...ExpressionAttributeValues,
      ":before": { S: before },
      ":after": { S: after },
    };
    queryCommand = {
      ...queryCommand,
      FilterExpression: "#dateAttr >= :before AND #dateAttr <= :after",
      ExpressionAttributeNames: {
        "#dateAttr": "sent_on",
      },
      ExpressionAttributeValues,
    };
  }

  const results = await dbClient.send(new QueryCommand(queryCommand), {}).then(
    (res) => {
      return (
        (res.Items?.map((item) => unmarshall(item)) as CategorizedEmail[]) ?? []
      );
    },
    (rej) => console.error({ rej })
  );
  const payload = results ?? [];
  cacheExpiry = now + 60 * 1000; // 1-minute TTL
  cachedData.set(cacheKey, { expiry: cacheExpiry, payload });
  return payload;
};

type SearchQueries = Partial<Record<keyof OpenSearchRecord, MatchQuery>>;

export const fetchSuggestedApplications = async (
  username: string,
  mustQueries: SearchQueries[] = [],
  shouldQueries: SearchQueries[] = [],
  size: number = 500
) => {
  const index = `user-${username}`;
  const client = await openSearchClient();

  const flattenQueries = (queries: Record<string, MatchQuery>[]) => {
    return queries.flatMap((record) => {
      return Object.entries(record).flatMap((query) => {
        const [field, matchQuery] = query;
        return {
          match: {
            [field]: matchQuery,
          },
        };
      });
    });
  };

  const formattedMustQueries: QueryContainer[] = flattenQueries(mustQueries);

  const formattedShouldQueries: QueryContainer[] =
    flattenQueries(shouldQueries);

  const body: Search_RequestBody = {
    size,
    track_total_hits: true,
    _source: {
      excludes: ["vector_embedding", "text"],
    },
    query: {
      bool: {
        must: [...formattedMustQueries].filter(Boolean) as QueryContainer[],
        should: [...formattedShouldQueries].filter(Boolean) as QueryContainer[],
      },
    },
  };

  const searchResp = await client.search({
    index,
    body,
  });

  return searchResp.body;
};

const filterToFieldMap: Record<FilterType, keyof OpenSearchRecord> = {
  [FilterType.Id]: "id",
  [FilterType.Company]: "company_title",
  [FilterType.Position]: "job_title",
  [FilterType.Subject]: "subject",
  [FilterType.Group]: "group_id",
};

export const searchFromOS = cache(async (
  username: string,
  params: DashboardParams,
  size: number = 500
) => {
  const {
    filters = [],
    dateKey = DateRanges.Monthly,
    absolute,
    searchTerm,
  } = params;

  const index = `user-${username}`;
  const client = await openSearchClient();
  const dates = getIntervalDates(dateKey, absolute);
  const formattedFilters: QueryContainer[] = filters.map((filter) => ({
    match: {
      [filterToFieldMap[filter.category]]: {
        query: filter.value.trim(),
        minimum_should_match: "95%",
      },
    },
  }));
  const dateFilter: QueryContainer = {
    range: {
      sent_on: {
        gte: dates[0].toISOString(),
        lte: dates[dates.length - 1].toISOString(),
      },
    },
  };

  const searchTermQuery: QueryContainer | null = searchTerm
    ? {
        multi_match: {
          query: searchTerm,
          fields: [
            "text",
            "subject",
            "from",
            "company_title",
            "job_title",
            "status",
          ] as (keyof OpenSearchRecord)[],
          fuzziness: "AUTO",
          minimum_should_match: "95%",
        },
      }
    : null;

  const body: Search_RequestBody = {
    size,
    track_total_hits: true,
    _source: {
      excludes: ["vector_embedding", "text"],
    },
    query: {
      bool: {
        must: [...formattedFilters, dateFilter, searchTermQuery].filter(
          Boolean
        ) as QueryContainer[],
      },
    },
  };

  const searchResp = await client.search({
    index,
    body,
  });

  return searchResp.body;
});

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const dateRangeValue: Record<keyof typeof DateRanges, number> = {
  [DateRanges.Weekly]: 7,
  [DateRanges.Bi_Weekly]: 14,
  [DateRanges.Monthly]: 30,
  [DateRanges.Quarterly]: 120,
  [DateRanges.Yearly]: 365,
};

export const getRelativeRangeDates: Record<
  keyof typeof DateRanges,
  (date: Date) => [Date, Date]
> = {
  [DateRanges.Weekly]: (date: Date) => {
    const intervalLength = dateRangeValue[DateRanges.Weekly];
    const firstSundayOfYear = new Date();
    firstSundayOfYear.setFullYear(firstSundayOfYear.getFullYear(), 0, 0);
    firstSundayOfYear.setDate(
      firstSundayOfYear.getDate() + 7 - firstSundayOfYear.getDay()
    );
    const base = new Date(firstSundayOfYear.toDateString());
    const diffInMs = Math.abs(date.getTime() - base.getTime());
    const diffInDays = Math.floor(diffInMs / MS_PER_DAY);
    const daysIntoInterval = diffInDays % intervalLength;
    const startOfInterval = new Date(date);
    startOfInterval.setDate(date.getDate() - daysIntoInterval);

    const endOfInterval = new Date(startOfInterval.toDateString());
    endOfInterval.setDate(startOfInterval.getDate() + intervalLength);
    return [startOfInterval, endOfInterval];
  },
  [DateRanges.Bi_Weekly]: (date: Date) => {
    const intervalLength = dateRangeValue[DateRanges.Bi_Weekly];
    const firstSundayOfYear = new Date();
    firstSundayOfYear.setFullYear(firstSundayOfYear.getFullYear(), 0, 0);
    firstSundayOfYear.setDate(
      firstSundayOfYear.getDate() + 7 - firstSundayOfYear.getDay()
    );
    const base = new Date(firstSundayOfYear.toDateString());
    const diffInMs = Math.abs(date.getTime() - base.getTime());
    const diffInDays = Math.floor(diffInMs / MS_PER_DAY);
    const daysIntoInterval = diffInDays % intervalLength;
    const startOfInterval = new Date(date);
    startOfInterval.setDate(date.getDate() - daysIntoInterval);
    const endOfInterval = new Date(startOfInterval.toDateString());
    endOfInterval.setDate(startOfInterval.getDate() + intervalLength);
    return [startOfInterval, endOfInterval];
  },
  [DateRanges.Monthly]: (date: Date) => {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    );
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    );
    return [start, end];
  },
  [DateRanges.Quarterly]: (date: Date) => {
    const start = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        Math.floor((date.getUTCMonth() / 4) * 3),
        1
      )
    );
    const end = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        Math.floor(date.getUTCMonth() / 4) * 3 + 3,
        0
      )
    );
    return [start, end];
  },
  [DateRanges.Yearly]: (date: Date) => {
    const start = new Date(date.toDateString());
    start.setMonth(0);
    start.setDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.toDateString());
    end.setFullYear(date.getFullYear() + 1);
    end.setMonth(0);
    end.setDate(0);
    end.setUTCHours(0, 0, 0, 0);
    return [start, end];
  },
};

export const getAbsoluteRangeStart: Record<
  keyof typeof DateRanges,
  (date: Date) => Date
> = {
  [DateRanges.Weekly]: (date: Date) => {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 7);
    return startDate;
  },
  [DateRanges.Bi_Weekly]: (date: Date) => {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 14);
    return startDate;
  },
  [DateRanges.Monthly]: (date: Date) => {
    const startDate = new Date(date);
    startDate.setMonth(startDate.getMonth() - 1);
    return startDate;
  },
  [DateRanges.Quarterly]: (date: Date) => {
    const startDate = new Date(date);
    startDate.setMonth(startDate.getMonth() - 3);
    return startDate;
  },
  [DateRanges.Yearly]: (date: Date) => {
    const startDate = new Date(date);
    startDate.setFullYear(startDate.getFullYear() - 1);
    return startDate;
  },
};

export const absoluteDateRangeIntervals: Record<
  keyof typeof DateRanges,
  number
> = {
  [DateRanges.Weekly]: 1,
  [DateRanges.Bi_Weekly]: 2,
  [DateRanges.Monthly]: 7,
  [DateRanges.Quarterly]: 14,
  [DateRanges.Yearly]: 30,
};

export function getRelativeIntervalInfo(
  targetDate: Date,
  dateRange: DateRange
) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const intervalLength = absoluteDateRangeIntervals[dateRange];
  const [startOfInterval, endOfInterval] =
    getRelativeRangeDates[dateRange](targetDate);
  const diffInMs = Math.abs(targetDate.getTime() - startOfInterval.getTime());
  const diffInDays = Math.floor(diffInMs / MS_PER_DAY);
  const daysIntoInterval = diffInDays % intervalLength;
  return {
    daysIntoInterval,
    startOfInterval,
    endOfInterval,
  };
}

export function getIntervalDates(
  dateKey: DateRange,
  absolute: boolean = false
) {
  const intervalLength = absoluteDateRangeIntervals[dateKey];

  const startDate: Date = new Date();
  const endDate: Date = new Date();

  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(0, 0, 0, 0);

  let intervalStartDate = startDate;
  let intervalEndDate = endDate;

  if (!absolute) {
    let { startOfInterval, endOfInterval } = getRelativeIntervalInfo(
      endDate,
      dateKey
    );
    intervalStartDate = new Date(startOfInterval);
    intervalEndDate = new Date(endOfInterval);
  } else {
    intervalStartDate = getAbsoluteRangeStart[dateKey](startDate);
  }

  let cursor = intervalStartDate.getTime();
  cursor += MS_PER_DAY * intervalLength;
  const intervalsInbetween = [];
  while (cursor < intervalEndDate.getTime()) {
    intervalsInbetween.push(new Date(cursor));
    cursor += MS_PER_DAY * intervalLength;
  }
  return [intervalStartDate, ...intervalsInbetween, intervalEndDate];
}

export const groupByDateRange = (
  dateKey: DateRange,
  email: CategorizedEmail,
  dates: Date[]
) => {
  const sentOn = new Date(email.sent_on);
  sentOn.setUTCHours(0, 0, 0, 0); // Normalize to start of the day

  const intervalLength = absoluteDateRangeIntervals[dateKey];
  return (
    dates.find(
      (date) =>
        date.getTime() <= sentOn.getTime() &&
        date.getTime() + intervalLength * MS_PER_DAY > sentOn.getTime()
    ) ?? new Date()
  );
};
