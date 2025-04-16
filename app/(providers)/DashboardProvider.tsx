import { DateRange, DateRanges } from "@/lib/consts";
import { ApplicationStatus } from "@/types";
import React, { createContext, ReactNode, useContext, useState } from "react";

interface DashboardContextValue {
  // Define the shape of your context value here
  options: ChartOptions;
  setOptions: React.Dispatch<React.SetStateAction<ChartOptions>>;
  emails: CategorizedEmail[];
  setEmails: React.Dispatch<React.SetStateAction<CategorizedEmail[]>>;
  chartData: ApplicationData;
  setChartData: React.Dispatch<React.SetStateAction<ApplicationData>>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

type ChartOptions = {
  displayedStatistics: StatisticKey[];
  dateKey: DateRange;
  absolute: boolean;
};

export const Statistics = {
  TOTAL_APPLICATIONS: "Total Applications Sent",
  TOTAL_RESPOSNES: "Total Responses",
  TOTAL_INTERVIEWS: "Total Interviews",
  REJECT_RATE: "Rejection Rate",
  AVERAGE_RESPONSE_TIME: "Average Response Time",
  RESPONSE_BY_CATEGORY: "Responses by Category",
};

export type StatisticKey = keyof typeof Statistics;
type StatisticValue = (typeof Statistics)[StatisticKey];

export type ApplicationData = Record<ApplicationStatus, number>[];

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [emails, setEmails] = useState<CategorizedEmail[]>([]);
  const [chartData, setChartData] = useState<ApplicationData>([]);
  const [options, setOptions] = useState<ChartOptions>({
    displayedStatistics: ["TOTAL_APPLICATIONS"] as StatisticKey[],
    dateKey: DateRanges.Monthly,
    absolute: false,
  });
  return (
    <DashboardContext.Provider
      value={{
        options,
        setOptions,
        emails,
        setEmails,
        chartData,
        setChartData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextValue => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
