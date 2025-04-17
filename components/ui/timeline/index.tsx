import { ApplicationStatusColor } from "@/components/helpers";
import { getEmailIem, setEmailItem } from "@/lib/clientCache";
import { cn } from "@/lib/utils";
import { ApplicationStatus, GroupRecord } from "@/types";
import { motion } from "framer-motion";
import { FC, SVGProps, useCallback, useEffect, useMemo, useState } from "react";
import { TooltipProvider } from "../tooltip";
import {
  BreadCrumbItem,
  CIRCLE_DURATION,
  LINE_DURATION,
} from "./breadcrumb-item";

const getStepColor = (id?: string, status?: ApplicationStatus) => {
  return id && status
    ? (ApplicationStatusColor[status] ?? "var(--color-gray-300)")
    : "var(--color-gray-300)";
};

type FetchData = { emails: CategorizedEmail[] };

type BreadCrumbData = {
  email?: CategorizedEmail;
  id?: string;
  application_status?: ApplicationStatus;
  sent_on?: string;
};

const TimelineBreadCrumbs = (props: {
  expand: boolean;
  applicationData: GroupRecord;
  editMode: boolean;
}) => {
  const { applicationData, editMode, expand } = props;
  const [groupEmails, setGroupEmails] = useState<CategorizedEmail[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!expand) {
      return;
    }
    setIsFetching(true);
    const groupEmailIds = Object.values(applicationData?.email_ids).flat();
    if (groupEmailIds.every((emailId) => getEmailIem(emailId))) {
      setGroupEmails(
        groupEmailIds.map((emailId) => getEmailIem(emailId) as CategorizedEmail)
      );
      setIsFetching(false);
      return;
    }

    const baseURL = "/api/applications/emails";

    const searchParams = new URLSearchParams({
      applicationId: applicationData.id,
    });
    const url = `${baseURL}?${searchParams.toString()}`;
    let newEmails: CategorizedEmail[] = [];
    fetch(url)
      .then((x) => {
        return x.json() as Promise<FetchData>;
      })
      .then((data) => {
        console.log({ data });
        setIsFetching(false);
        data.emails.forEach((email) => {
          setEmailItem(email.id, email);
          newEmails.push(email);
        });
        setGroupEmails((prev) => {
          return [...prev, ...newEmails].sort((a, b) => {
            return (
              new Date(a.sent_on).getTime() - new Date(b.sent_on).getTime()
            );
          });
        });
      });
  }, [expand]);

  // const { emails } = useDashboard();

  const timelineItems = useMemo(() => {
    let timelineItems: BreadCrumbData[] = groupEmails.map((email) => ({
      email,
      application_status: email.application_status,
    }));
    groupEmails.map((email) => ({
      email,
      application_status: email.application_status,
    }));
    if (
      !timelineItems.some(
        (email) =>
          email.application_status === ApplicationStatus.ApplicationAcknowledged
      )
    ) {
      timelineItems.unshift({
        application_status: ApplicationStatus.ApplicationAcknowledged,
      });
    }
    if (editMode) {
      timelineItems.push({});
    }
    return timelineItems;
  }, [groupEmails, editMode]);

  const Items = useCallback(() => {
    return timelineItems.map(({ application_status, email }, i) => {
      return (
        <BreadCrumbItem
          applicationData={applicationData}
          emailData={email}
          stepColor={getStepColor(email?.id, application_status)}
          key={`${i}-${email?.id ?? application_status}`}
          editMode={editMode}
          isLoading={isFetching}
          status={application_status}
          isLast={i === timelineItems.length - 1}
          index={i}
        />
      );
    });
  }, [timelineItems, editMode]);

  const Gradients = useCallback(() => {
    return timelineItems.map(({ email, application_status }, i) => {
      return (
        <LinearGradient
          id={`gradient-${applicationData.id}-${i}`}
          steps={
            [
              getStepColor(email?.id, application_status),
              getStepColor(
                timelineItems[i + 1]?.email?.id,
                timelineItems[i + 1]?.application_status
              ),
            ].filter(Boolean) as string[]
          }
        />
      );
    });
  }, [timelineItems]);

  return (
    <motion.ol
      className={cn(
        "flex flex-col justify-center w-min pb-5"
      )}
      transition={{
        staggerChildren: LINE_DURATION + CIRCLE_DURATION * 10,
      }}
      variants={{ visible: { opacity: 1 }, hidden: { opacity: 0 } }}
      initial="hidden"
      animate={"visible"}
    >
      <svg className="absolute z-[-20] h-0 w-0 opacity-0">
        <defs>
          <Gradients />
        </defs>
      </svg>
      <TooltipProvider>
        <Items />
      </TooltipProvider>
    </motion.ol>
  );
};

const LinearGradient: FC<
  Partial<SVGProps<SVGLinearGradientElement>> & { steps: string[] }
> = (props) => {
  const { steps, ...otherProps } = props;
  return (
    <linearGradient
      x1="0"
      y1="0"
      x2="0"
      y2="28"
      gradientUnits="userSpaceOnUse"
      {...otherProps}
    >
      {steps.map((stopColor, i, arr) => (
        <stop
          offset={i / (Math.max(arr.length, 2) - 1)}
          key={i}
          style={{ stopColor }}
        />
      ))}
    </linearGradient>
  );
};

export default TimelineBreadCrumbs;
