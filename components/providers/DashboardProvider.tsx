"use client";

import { useApplications, useEmails } from "@/lib/hooks";
import {
  ApplicationStatus,
  DashboardParams,
  Filter,
  FilterType,
  GroupRecord,
} from "@/types";
import Cookies from "js-cookie";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { SWRResponse } from "swr";
import { createSafeId } from "../helpers";

export type FetchedRecords = keyof Omit<FetchData, "maxApplications">;

interface DashboardContextValue {
  applications: SWRResponse<GroupRecord[]> & {
    currPage: number;
    maxApplications: number;
    presorted: boolean;
  };
  params: DashboardParams;
  setParams: React.Dispatch<React.SetStateAction<DashboardParams>>;
  emails: SWRResponse<Partial<Pick<FetchData, "emails" | "chartData">>>;
  chartData: ApplicationData;
  focusToEmail: (emailId: string, filters?: Filter[]) => void;
  activeEmailIdx: number | null;
  setActiveEmailIdx: React.Dispatch<React.SetStateAction<number | null>>;
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
  initalDashboardParams: DashboardParams;
}> = ({ children, initalDashboardParams }) => {
  const [params, setParams] = useState<DashboardParams>(initalDashboardParams);
  const emails = useEmails({ params });
  const applications = useApplications({ emails: emails.data?.emails, params });
  const [chartData, setChartData] = useState<ApplicationData>(
    emails.data?.chartData || []
  );

  const [activeEmailIdx, setActiveEmailIdx] = useState<number | null>(null);

  const focusToEmail = (emailId: string) => {
    const emailArr = emails.data?.emails || [];
    const idx = emailArr.findIndex((email) => email.id === emailId);
    if (idx) {
      setActiveEmailIdx(idx);
      const emailCardElement = document.getElementById("email-card");
      if (emailCardElement) {
        emailCardElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        const id = createSafeId(emailArr[idx].id);
        const emailElement = emailCardElement.querySelector(`#${id}`);
        if (emailElement) {
          const parent = emailElement.closest("[role=group");
          parent?.scrollTo({
            top:
              Math.abs(
                (parent as HTMLElement).offsetTop -
                  (emailElement as HTMLElement).offsetTop
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
        applicationSortKey: params.applicationSortKey,
        emailSortKey: params.emailSortKey,
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

  return (
    <DashboardContext.Provider
      value={{
        params,
        setParams,
        emails,
        chartData,
        applications,
        focusToEmail,
        activeEmailIdx,
        setActiveEmailIdx,
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
