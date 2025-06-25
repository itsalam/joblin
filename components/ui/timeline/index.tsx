import { useDashboard } from "@/components/providers/DashboardProvider";
import { cn } from "@/lib/utils";
import { ApplicationStatus, FilterType, Group } from "@/types";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { TooltipProvider } from "../tooltip";
import { BreadCrumbItem } from "./breadcrumb-item";
import {
  BASE_URL,
  BreadCrumbData,
  CategorizedEmailDisplayData,
  CIRCLE_DURATION,
  FetchData,
  getStepColor,
  groupToArr,
  LINE_DURATION,
} from "./helpers";
import { LinearGradient } from "./shapes";

const TimelineBreadCrumbs = (props: {
  expand: boolean;
  id: string;
  emailIds: Group<ApplicationStatus, string[]>;
  editMode: boolean;
}) => {
  const { focusToEmail } = useDashboard();
  const { emailIds: emailIdsProp, editMode, expand, id } = props;
  const [groupEmails, setGroupEmails] = useState<CategorizedEmailDisplayData[]>(
    groupToArr(emailIdsProp).map(({ value, status }) => ({
      id: value,
      application_status: status,
    }))
  );

  const { data, mutate, isLoading, isValidating } = useSWR(
    [BASE_URL, id],
    ([baseUrl, applicationId]) => {
      const searchParams = new URLSearchParams({
        applicationId: applicationId ?? "",
      });
      const url = `${baseUrl}?${searchParams.toString()}`;
      return fetch(url)
        .then((x) => {
          return x.json() as Promise<FetchData>;
        })
        .then((data) => data);
    },
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // refreshInterval: 3000,
      // dedupingInterval: 5000,
    }
  );

  useEffect(() => {
    setGroupEmails((prev) => {
      const updatedEmails = prev.map((email) => {
        const newEmail = data?.emails.find((e) => e.id === email.id);
        return { ...email, ...newEmail };
      });
      const newEmails =
        data?.emails.filter((email) => !prev.some((e) => e.id === email.id)) ||
        [];
      const uniqueEmails = new Map<string, CategorizedEmailDisplayData>(
        [...updatedEmails, ...newEmails].map((e) => [e.id, e])
      );

      const res = Array.from(uniqueEmails.values()).sort((a, b) => {
        return a.sent_on && b.sent_on
          ? new Date(a.sent_on).getTime() - new Date(b.sent_on).getTime()
          : a.application_status.localeCompare(b.application_status) || 0;
      });
      return res;
    });
  }, [data]);

  const Items = useCallback(
    ({ editMode }: { editMode: boolean }) => {
      let timelineItems: BreadCrumbData[] = groupEmails.map((email) => ({
        displayData: email,
        application_status: email.application_status,
      }));

      if (
        editMode &&
        !timelineItems.some(
          (email) =>
            email.application_status ===
            ApplicationStatus.ApplicationAcknowledged
        )
      ) {
        timelineItems.unshift({
          application_status: ApplicationStatus.ApplicationAcknowledged,
        });
      } else if (editMode) {
        timelineItems.push({});
      }
      return timelineItems.map((
        { application_status, displayData: email },
        i
      ) => {
        return (
          <BreadCrumbItem
            onClick={() =>
              email &&
              focusToEmail(
                email.id,
                email?.group_id
                  ? [{ category: FilterType.Group, value: email?.group_id }]
                  : []
              )
            }
            emailData={email}
            stepColor={getStepColor(email?.id, application_status)}
            key={`${i}-${email?.id ?? application_status}-${isLoading ? "loading" : ""}`}
            editMode={editMode}
            isLoading={isLoading || isValidating}
            status={application_status}
            isLast={i === timelineItems.length - 1}
            index={i}
          />
        );
      });
    },
    [groupEmails, isLoading, isValidating]
  );

  const Gradients = useCallback(() => {
    return groupEmails.map((email, i) => {
      return (
        <LinearGradient
          id={`gradient-${id}-${i}`}
          key={`gradient-${id}-${i}`}
          steps={
            [
              getStepColor(email?.id, email.application_status),
              getStepColor(
                groupEmails[i + 1]?.id,
                groupEmails[i + 1]?.application_status
              ),
            ].filter(Boolean) as string[]
          }
        />
      );
    });
  }, [groupEmails]);

  return (
    <motion.ol
      layout="preserve-aspect"
      className={cn(
        "flex flex-col justify-items-start w-min"
      )}
      transition={{
        staggerChildren: LINE_DURATION + CIRCLE_DURATION * 10,
      }}
      variants={{
        visible: { opacity: [null, 1] },
        hidden: { opacity: [null, 0] },
      }}
      initial={expand ? false : "hidden"}
      animate={expand ? "visible" : "hidden"}
    >
      <svg className="h-0 w-0">
        <defs>
          <Gradients />
        </defs>
      </svg>
      <TooltipProvider>
        <Items editMode={editMode} />
      </TooltipProvider>
    </motion.ol>
  );
};

export default TimelineBreadCrumbs;
