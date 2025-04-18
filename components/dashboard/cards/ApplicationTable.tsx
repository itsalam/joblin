import { useDashboard } from "@/app/(providers)/DashboardProvider";
import { ApplicationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditInput } from "@/components/ui/edit-input";
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
            <th className="pl-3 w-8"></th>
            <th className="pl-3 text-start font-medium w-sm">Company</th>
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
  const toggleExpand = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, textarea, select, [data-no-drawer], [role=menuitem], [role=menu], [role=button], [role=tab], [role=treeitem], [role=option], [role=input]"
      ) // opt-out selector
    ) {
      return;
    } else {
      console.log(target);
      setExpand((prev) => !prev);
      setEdit(false);
    }
  };

  const [expand, setExpand] = useState<boolean>(false);
  const [edit, setEdit] = useState(false);

  return (
    <>
      <motion.tr
        layoutId={`row-${application.id}`}
        className={`text-sm ${index % 2 ? "bg-slate-100" : "bg-white"}`}
        onClick={toggleExpand}
      >
        <td className="px-3 w-8 text-lg">
          <div className="flex flex-col items-center justify-center gap-2">
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
          </div>
        </td>

        <td className="flex items-center gap-3 relative shrink w-min">
          <div className="py-5 ">
            <LogoAvatar company={application.company_title} size={48} />
          </div>
          <div>
            <EditInput
              key={`title-${application.id}`}
              className="block font-medium"
              edit={edit}
              value={application.company_title}
            />
            <EditInput
              key={`job-${application.id}`}
              className="text-xs text-slate-500 max-w-2xs"
              edit={edit}
              value={application.job_title}
            >
              <div
                {...{
                  contentEditable: edit,
                  suppressContentEditableWarning: true,
                }}
              >
                {application.job_title}
              </div>
            </EditInput>
          </div>
        </td>

        <td className="py-5 pr-3">
          {application.last_status && (
            <ApplicationBadge status={application.last_status} />
          )}
        </td>

        <td className="py-5 text-ellipsis">
          <p className="block font-medium">{application.last_email_subject}</p>
          <p className="block text-xs text-slate-500">
            {application.last_updated
              ? timeAgo(application.last_updated)
              : null}
          </p>
        </td>
        <td className="py-5 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={"icon"}
                className="hover:bg-slate-200 rounded-full aspect-square"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-80 w-40 border-zinc-200 dark:border-zinc-800">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={(e) => {
                    setEdit(!edit);
                    setExpand(true);
                  }}
                >
                  <p className="flex cursor-pointer items-center gap-2 text-zinc-800 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                    <span>{/* <User /> */}</span>
                    Edit
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                    <span>{/* <Store /> */}</span>
                    Delete
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                    <span>{/* <Lightbulb /> */}</span>
                    Pin
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <p className="mt-2 flex cursor-pointer items-center gap-2 pt-1 text-zinc-950 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                    <span>{/* <Settings /> */}</span>
                    Panel 4
                  </p>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </motion.tr>

      <motion.tr
        layoutId={`row-${application.id}-details`}
        layout="preserve-aspect"
        className={` ${index % 2 ? "bg-slate-100" : "bg-white"}`}
      >
        <motion.td colSpan={6}>
          <motion.div
            initial={{ maxHeight: 0 }}
            animate={{ maxHeight: expand ? 200 : 0 }}
            exit={{ maxHeight: 0 }}
            transition={{ duration: 0.3 }}
            className="flex overflow-y-auto overflow-x-hidden gap-0.5 text-xs text-zinc-600 dark:text-white w-full px-15"
          >
            <TimelineBreadCrumbs
              expand={expand}
              applicationData={application}
              editMode={edit}
            />
          </motion.div>
        </motion.td>
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
