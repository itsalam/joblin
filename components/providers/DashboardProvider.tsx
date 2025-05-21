"use client";

import { setEmailItem } from "@/lib/clientCache";
import {
  ApplicationStatus,
  DashboardParams,
  FilterType,
  GroupRecord,
} from "@/types";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { composeDashboardData } from "../../app/(actions)/composeDashboard";
import { createSafeId } from "../helpers";

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
  focusToEmail: (emailId: string) => void;
  activeEmail: CategorizedEmail | null;
  setActiveEmail: React.Dispatch<React.SetStateAction<CategorizedEmail | null>>;
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
  const [activeEmail, setActiveEmail] = useState<CategorizedEmail | null>(null);
  const [params, setParams] = useState<DashboardParams>(initalDashboardParams);

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
          console.log(
            parent?.offsetTop ?? 0 - (emailElement as HTMLElement).offsetTop
          );
          parent?.scrollTo({
            top:
              Math.abs(
                parent.offsetTop - (emailElement as HTMLElement).offsetTop
              ) - 12,
            behavior: "smooth",
          });
        }
        // setTimeout(() => {
        //   console.log(emailCardElement.querySelector(`#${id}`));

        //   emailCardElement.querySelector(`#${id}`)?.scrollIntoView({
        //     behavior: "smooth",
        //     block: "center",
        //     inline: "nearest",
        //   });
        // }, 0);
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
        focusToEmail,
        activeEmail,
        setActiveEmail,
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
