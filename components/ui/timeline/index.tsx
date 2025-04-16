import { getEmailIem, setEmailItem } from "@/lib/clientCache";
import { cn } from "@/lib/utils";
import { ApplicationStatus, GroupRecord } from "@/types";
import { motion } from "framer-motion";
import { FC, SVGProps, useCallback, useEffect, useState } from "react";
import { TooltipProvider } from "../tooltip";
import {
  BreadCrumbItem,
  CIRCLE_DURATION,
  LINE_DURATION,
} from "./breadcrumb-item";

const getStartColor = (
  status: ApplicationStatus,
  i: number,
  currStatusIndex: number
) => {
  const isCurrIndex = i === currStatusIndex;
  return isCurrIndex
    ? status === ApplicationStatus.Rejected
      ? "var(--color-red-400)"
      : "var(--color-green-400)"
    : i < currStatusIndex
      ? "var(--color-lime-400)"
      : undefined;
};

type FetchData = { emails: CategorizedEmail[] };

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

  const currStatusIndex = 0;

  const Items = useCallback(() => {
    return groupEmails.map(({ id, application_status, sent_on }, i) => {
      return (
        <BreadCrumbItem
          applicationData={applicationData}
          startColor={getStartColor(application_status, i, currStatusIndex)}
          endColor={getStartColor(application_status, i + 1, currStatusIndex)}
          key={`${i}-${id}`}
          editMode={editMode}
          isLoading={isFetching}
          external_id={id}
          status={application_status}
          isLast={i !== groupEmails.length - 1}
          index={i}
          currStatusIndex={currStatusIndex}
          date={sent_on ?? undefined}
        />
      );
    });
  }, [groupEmails, editMode]);

  return (
    <motion.ol
      className={cn(
        "flex gap-2 justify-center py-4"
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
          <LinearGradient
            id={"pastOngoing"}
            steps={["var(--color-green-400)", "var(--color-gray-400)"]}
          />
          <LinearGradient
            id={"toOngoing"}
            steps={["var(--color-lime-400)", "var(--color-green-400)"]}
          />
          <LinearGradient
            id={"toReject"}
            steps={["var(--color-lime-400)", "var(--color-red-400)"]}
          />
          <LinearGradient id={"default"} steps={["var(--color-lime-400)"]} />
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
      y1="12"
      x2="24"
      y2="12"
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
