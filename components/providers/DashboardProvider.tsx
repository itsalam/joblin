"use client";

import { setEmailItem } from "@/lib/clientCache";
import { ApplicationStatus, DashboardParams, GroupRecord } from "@/types";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { composeDashboardData } from "../../app/actions/composeDashboard";

export type FetchedRecords = keyof FetchData;

interface DashboardContextValue {
  isFetching: Record<FetchedRecords, boolean>;
  applications: GroupRecord[];
  setApplications: React.Dispatch<React.SetStateAction<GroupRecord[]>>;
  latestData: React.RefObject<FetchData>;
  params: DashboardParams;
  setParams: React.Dispatch<React.SetStateAction<DashboardParams>>;
  emails: CategorizedEmail[];
  setEmails: React.Dispatch<React.SetStateAction<CategorizedEmail[]>>;
  chartData: ApplicationData;
  setChartData: React.Dispatch<React.SetStateAction<ApplicationData>>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

export type ApplicationData = Record<ApplicationStatus, number | null>[];

export type FetchData = {
  chartData: ApplicationData;
  emails: CategorizedEmail[];
  applications?: GroupRecord[];
};

export const DashboardProvider: React.FC<{
  children: ReactNode;
  fetchData: FetchData;
  initalDashboardParams: DashboardParams;
}> = ({ fetchData, children, initalDashboardParams }) => {
  const [emails, setEmails] = useState<CategorizedEmail[]>(fetchData.emails);
  const [applications, setApplications] = useState<GroupRecord[]>(
    fetchData.applications || []
  );
  const [chartData, setChartData] = useState<ApplicationData>(
    fetchData.chartData
  );
  const [isFetching, setIsFetching] = useState({
    emails: false,
    applications: false,
    chartData: false,
  });
  const latestData = useRef<FetchData>({ chartData, emails });
  const [params, setParams] = useState<DashboardParams>(initalDashboardParams);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setIsFetching({
      emails: true,
      applications: true,
      chartData: true,
    });
    composeDashboardData(params).then((data) => {
      setIsFetching({
        emails: !!!data.emails,
        applications: !!!data.applications,
        chartData: !!!data.chartData,
      });
      latestData.current = data;
      setEmails(data.emails);
      data.emails.forEach((email) => {
        setEmailItem(email.id, email);
      });
    });
  }, [params]);

  return (
    <DashboardContext.Provider
      value={{
        isFetching,
        params,
        setParams,
        emails,
        setEmails,
        chartData,
        setChartData,
        latestData,
        applications,
        setApplications,
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
