"use client";

import {
  ApplicationData,
  StatisticKey,
  Statistics,
  useDashboard,
} from "@/app/(providers)/DashboardProvider";
import LineChart from "@/components/charts/EmailChart";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ApplicationStatus } from "@/types";
import { LucideIcon, Mail } from "lucide-react";
import { useEffect, useRef } from "react";

type StatisticDisplay = {
  label: string;
  icon?: LucideIcon;
  getValue: (data: CategorizedEmail[], appData?: ApplicationData) => number;
};

export const StatisticMap: Record<StatisticKey, StatisticDisplay> = {
  TOTAL_APPLICATIONS: {
    label: Statistics.TOTAL_APPLICATIONS,
    icon: undefined, // Add a Lucide icon like `Send` if needed
    getValue: (data) => data.length,
  },
  TOTAL_RESPOSNES: {
    label: Statistics.TOTAL_RESPOSNES,
    getValue: (data) =>
      data.filter(
        (d) =>
          d.application_status === ApplicationStatus.ApplicationAcknowledged
      ).length,
  },
  TOTAL_INTERVIEWS: {
    label: Statistics.TOTAL_INTERVIEWS,
    getValue: (data) =>
      data.filter(
        (d) => d.application_status === ApplicationStatus.InterviewRequested
      ).length,
  },
  REJECT_RATE: {
    label: Statistics.REJECT_RATE,
    getValue: (data) => {
      const rejections = data.filter(
        (d) => d.application_status === ApplicationStatus.Rejected
      ).length;
      return Math.round((rejections / data.length) * 100);
    },
  },
  AVERAGE_RESPONSE_TIME: {
    label: Statistics.AVERAGE_RESPONSE_TIME,
    getValue: (data) => {
      // const responseTimes = data
      //   .filter((d) => d.respondedAt && d.sentAt)
      //   .map(
      //     (d) =>
      //       (new Date(d.respondedAt).getTime() - new Date(d.sentAt).getTime()) /
      //       1000
      //   );

      // const avg =
      //   responseTimes.reduce((a, b) => a + b, 0) / (responseTimes.length || 1);
      return Math.round(0);
    },
  },
  RESPONSE_BY_CATEGORY: {
    label: Statistics.RESPONSE_BY_CATEGORY,
    getValue: () => 0, // You could leave this to chart instead of card
  },
};

function CategorizedEmailChart({
  emails,
  isFetching,
  chartData,
}: {
  emails: CategorizedEmail[];
  chartData: ApplicationData;
  isFetching: boolean;
}) {
  const { options } = useDashboard();
  const hasFetched = useRef(false);

  useEffect(() => { 
    hasFetched.current = hasFetched.current || isFetching;
  }, [isFetching]);

  const StatisticCard = ({ statistic }: { statistic: StatisticDisplay }) => {
    const Icon = statistic.icon ?? Mail;
    return (
      <div
        className={cn(
          "flex items-center gap-3 bg-gradient-to-b from-white via-white to-transparent dark:from-zinc-900 dark:to-transparent p-4 rounded-lg",
          isFetching && "opacity-25"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 text-4xl dark:border-zinc-800 dark:text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h5 className="text-sm font-medium leading-5 text-zinc-950 dark:text-white">
            {statistic.label}
          </h5>
          <p className="mt-1 text-2xl font-bold leading-6 text-zinc-950 dark:text-white w-fit">
            {hasFetched.current ? (
              statistic.getValue(emails)
            ) : (
              <Spinner size="small" />
            )}
          </p>
        </div>
      </div>
    );
  };


  return (
    <Card
      className={
        "border-zinc-200 p-6 dark:border-zinc-800 w-full overflow-hidden"
      }
    >
      <div className="flex items-center gap-3 bg-gradient-to-b from-white via-white to-transparent dark:from-zinc-900 dark:to-transparent ">
        {options.displayedStatistics.map((statisticKey) => {
          const statistic = StatisticMap[statisticKey];
          return <StatisticCard key={statisticKey} statistic={statistic} />;
        })}
      </div>


      <div className="flex h-[350px] w-full flex-row sm:flex-wrap lg:flex-nowrap 2xl:overflow-hidden border-t-1 border-zinc-200">
        <div className={cn("h-full w-full", isFetching && "opacity-25")}>
        
    <LineChart chartData={chartData} />
          {!hasFetched.current &&
          <div className="absolute h-full w-full flex items-center justify-center">
            <Spinner size="large" className="h-full" />
          </div>
          }
        </div>
      </div>
    </Card>
  );
}


export default CategorizedEmailChart;
