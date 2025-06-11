"use client";

import { composeApplications } from "@/app/(actions)/composeApplications";
import { composeEmails } from "@/app/(actions)/compostEmails";
import { useParams } from "@/lib/hooks";
import {
  ApplicationStatus,
  DashboardParams,
  FilterType,
  GroupRecord,
} from "@/types";
import Cookies from "js-cookie";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createSafeId } from "../helpers";

export type FetchedRecords = keyof Omit<FetchData, "maxApplications">;

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
  focusToEmail: (emailId: string) => void;
  activeEmail: CategorizedEmail | null;
  setActiveEmail: React.Dispatch<React.SetStateAction<CategorizedEmail | null>>;
  maxApplications: React.RefObject<number>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined
);

export type ApplicationData = Record<ApplicationStatus, number | null>[];

export type FetchData = {
  chartData: ApplicationData;
  emails: CategorizedEmail[];
  applications?: GroupRecord[];
  maxApplications?: number;
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
  const maxApplications = useRef<number>(fetchData.maxApplications || 1);
  const [activeEmail, setActiveEmail] = useState<CategorizedEmail | null>(null);
  const [params, setParams] = useState<DashboardParams>(initalDashboardParams);
  const [chartParams, setChartParams] = useParams<DashboardParams>(params, [
    "searchTerm",
    "filters",
    "absolute",
    "dateKey",
    "displayedStatistics",
  ]);
  const [emailParams, setEmailParams] = useParams<DashboardParams>(params, [
    "searchTerm",
    "filters",
    "absolute",
    "dateKey",
  ]);
  const [applicationParams, setApplicationParams] = useParams<DashboardParams>(
    params,
    ["searchTerm", "filters", "absolute", "dateKey", "applicationPageIndex"]
  );

  const latestData = useRef<FetchData>({ chartData, emails });
  const hasMounted = useRef(false);

  const focusToEmail = (emailId: string) => {
    const email = emails.find((email) => email.id === emailId);
    if (email) {
      setActiveEmail(email);
      const emailCardElement = document.getElementById("email-card");
      if (emailCardElement) {
        emailCardElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        const id = createSafeId(email.id);
        const emailElement = emailCardElement.querySelector(`#${id}`);
        if (emailElement) {
          const parent = emailElement.closest("[role=group");
          parent?.scrollTo({
            top:
              Math.abs(
                parent.offsetTop - (emailElement as HTMLElement).offsetTop
              ) - 12,
            behavior: "smooth",
          });
        }
      }
    } else {
      setParams((prevParams) => {
        const filters = prevParams.filters ?? [];
        filters.push({ category: FilterType.Id, value: emailId });
        return {
          ...prevParams,
          filters: filters,
        };
      });

      const emailElement = document.getElementById("email-card");
      if (emailElement) {
        emailElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }
  };

  useEffect(() => {
    Cookies.set(
      "dashboard-params",
      JSON.stringify({
        displayedStatistics: params.displayedStatistics,
        dateKey: params.dateKey,
        absolute: params.absolute,
      }),
      {
        path: "/",
        expires: 30, // 30 days
        ...(process.env.NODE_ENV === "development"
          ? { secure: false, sameSite: "Lax" }
          : { secure: true }),
      }
    );
  }, [params]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setIsFetching((prev) => ({ ...prev, chartData: true, emails: true }));
    composeEmails(chartParams).then((data) => {
      setIsFetching((prev) => ({ ...prev, chartData: false, emails: false }));
      setChartData(data.chartData);
      setEmails(data.emails);
    });
  }, [chartParams, emailParams]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setIsFetching((prev) => ({ ...prev, applications: true }));
    composeApplications(applicationParams).then((data) => {
      setIsFetching((prev) => ({ ...prev, applications: false }));
      setApplications(data.records || []);
      maxApplications.current = data.maxApplications || 1;
    });
  }, [applicationParams]);

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
        focusToEmail,
        activeEmail,
        setActiveEmail,
        maxApplications,
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
