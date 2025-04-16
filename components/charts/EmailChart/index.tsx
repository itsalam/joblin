"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ApplicationStatus } from "@/types";
// if you use app dir, don't forget this line
import { ComponentProps, memo } from "react";
import { Area, AreaChart, CartesianGrid, LineChart, XAxis } from "recharts";

const chartConfig = {
  1: {
    label: "value",
    color: "hsl(var(--chart-1))",
  },
  2: {
    label: "value",
    color: "hsl(var(--chart-2))",
  },
  3: {
    label: "value",
    color: "hsl(var(--chart-3))",
  },
  4: {
    label: "value",
    color: "hsl(var(--chart-4))",
  },
  5: {
    label: "value",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

export default memo(function EmailChart(props: {
  chartData: ComponentProps<typeof LineChart>["data"];
}) {
  const { chartData } = props;

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full h-full"
    >
      <AreaChart key={Math.random()} data={chartData}>
        <CartesianGrid />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Area
          isAnimationActive
          stackId="a"
          dataKey={ApplicationStatus.ApplicationAcknowledged}
          type="bump"
          stroke="var(--color-2)"
          fill="var(--color-2)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Area
          stackId="a"
          dataKey={ApplicationStatus.Complete}
          type="bump"
          stroke="var(--color-3)"
          fill="var(--color-3)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Area
          stackId="a"
          dataKey={ApplicationStatus.InterviewRequested}
          type="bump"
          stroke="var(--color-4)"
          fill="var(--color-4)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Area
          stackId="a"
          dataKey={ApplicationStatus.Proceed}
          type="bump"
          stroke="var(--color-5)"
          fill="var(--color-5)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />

        <Area
          stackId="a"
          dataKey={ApplicationStatus.Rejected}
          type="bump"
          stroke="var(--color-1)"
          fill="var(--color-1)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </AreaChart>
    </ChartContainer>
  );
});
