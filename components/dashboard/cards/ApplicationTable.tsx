import { useDashboard } from "@/app/(providers)/DashboardProvider";
import { ApplicationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TimelineBreadCrumbs from "@/components/ui/timeline";
import { timeAgo } from "@/lib/utils";
import { GroupRecord } from "@/types";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Ellipsis } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoAvatar } from "../LogoAvatar";

const ApplicationTable = () => {
  const baseURL = "/api/applications";
  const { options } = useDashboard();
  const [applications, setApplications] = useState<GroupRecord[]>([]);

  useEffect(() => {
    const searchParams = new URLSearchParams({
      dateRange: options.dateKey,
      ...(options.absolute ? { absolute: "1" } : {}),
    });
    options.displayedStatistics.forEach((stat, i) => {
      searchParams.append(`stat[${i}]`, stat);
    });
    const url = `${baseURL}?${searchParams.toString()}`;
    fetch(url)
      .then((x) => {
        return x.json();
      })
      .then((data) => {
        setApplications(data as GroupRecord[]);
        return data as GroupRecord[];
      });
  }, [options]);

  const shift = (id: string, direction: "up" | "down") => {
    const index = applications.findIndex((u) => u.id === id);
    let applicationsCopy = [...applications];

    if (direction === "up") {
      if (index > 0) {
        [applicationsCopy[index], applicationsCopy[index - 1]] = [
          applicationsCopy[index - 1],
          applicationsCopy[index],
        ];
      }
    } else {
      if (index < applicationsCopy.length - 1) {
        [applicationsCopy[index], applicationsCopy[index + 1]] = [
          applicationsCopy[index + 1],
          applicationsCopy[index],
        ];
      }
    }

    setApplications(applicationsCopy);
  };

  return (
    <Card className="w-full bg-white shadow-lg rounded-lg overflow-x-scroll mx-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-[1px] border-slate-200 text-slate-400 text-xs uppercase h-9">
            <th className="pl-4 w-8"></th>
            <th className="pl-3 text-start font-medium">Company</th>
            <th className="text-start font-medium">Status</th>
            <th className="text-start font-medium">Last Subject</th>
          </tr>
        </thead>

        <tbody>
          {applications.map((application, index) => {
            return (
              <TableRows
                key={application.id}
                application={application}
                index={index}
                shift={shift}
              />
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};

const TableRows = ({
  application,
  index,
  shift,
}: {
  application: GroupRecord;
  index: number;
  shift: (id: string, direction: "up" | "down") => void;
}) => {
  const rankOrdinal = numberToOrdinal(index + 1);
  // const maxRankOrdinal = numberToOrdinal(user.maxRank);
  const toggleExpand = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    console.log(e.target);
    // if (target.tagName === "TR" && target === e.currentTarget) {
    setExoand((prev) => !prev);
    // }
  };

  const [expand, setExoand] = useState<boolean>(false);

  return (
    <>
      <motion.tr
        layoutId={`row-${application.id}`}
        className={`text-sm ${index % 2 ? "bg-slate-100" : "bg-white"}`}
        onClick={toggleExpand}
      >
        <td className="pl-4 w-8 text-lg">
          <button
            className="hover:text-violet-600"
            onClick={() => shift(application.id, "up")}
          >
            <ChevronUp />
          </button>
          <button
            className="hover:text-violet-600"
            onClick={() => shift(application.id, "down")}
          >
            <ChevronDown />
          </button>
        </td>

        <td className="py-5 px-1 flex items-center gap-3 overflow-hidden">
          <LogoAvatar company={application.company_title} size={44} />
          <div>
            <span className="block font-medium">
              {application.company_title}
            </span>
            <span className="block text-xs text-slate-500">
              {application.job_title}
            </span>
          </div>
        </td>

        <td className="py-5">
          {application.last_status && (
            <ApplicationBadge status={application.last_status} />
          )}
        </td>

        <td className="py-5 text-ellipsis">
          <span className="block font-medium">
            {application.last_email_subject}
          </span>
          <span className="block text-xs text-slate-500">
            {application.last_updated
              ? timeAgo(application.last_updated)
              : null}
          </span>
        </td>
        <td className="py-5">
          <Button variant="ghost">
            <Ellipsis />
          </Button>
        </td>
      </motion.tr>

      <motion.tr
        layoutId={`row-${application.id}-details`}
        className={` ${index % 2 ? "bg-slate-100" : "bg-white"}`}
      >
        <td colSpan={6}>
          <motion.div
            initial={{ maxHeight: 0 }}
            animate={{ maxHeight: expand ? 160 : 0 }}
            exit={{ maxHeight: 0 }}
            transition={{ duration: 0.3 }}
            className="flex overflow-hidden flex-col gap-0.5 text-xs text-zinc-600 dark:text-white w-full"
          >
            <TimelineBreadCrumbs
              expand={expand}
              applicationData={application}
              editMode={false}
            />
          </motion.div>
        </td>
      </motion.tr>
    </>
  );
};

export default ApplicationTable;

const numberToOrdinal = (n: number) => {
  let ord = "th";

  if (n % 10 == 1 && n % 100 != 11) {
    ord = "st";
  } else if (n % 10 == 2 && n % 100 != 12) {
    ord = "nd";
  } else if (n % 10 == 3 && n % 100 != 13) {
    ord = "rd";
  }

  return n + ord;
};
