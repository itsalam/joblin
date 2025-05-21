import { composeDashboardData } from "@/app/(actions)/composeDashboard";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Card } from "@/components/ui/card";
import { GroupRecord } from "@/types";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TableRow } from "./ApplicationRow";
import { ApplicationDragProvider } from "./provider";

const ApplicationList = () => {
  const { applications, setApplications, params } = useDashboard();
  const container = useRef<HTMLDivElement>(null);
  const [draggedApplications, setDraggedApplications] = useState<GroupRecord[]>(
    []
  );

  const displayedApplications = applications.filter(
    (a) =>
      draggedApplications.length === 0 ||
      !draggedApplications.find((d) => d.id === a.id)
  );

  useEffect(() => {
    composeDashboardData(params, true).then((data) => {
      setApplications(data.applications || []);
    });
  }, [params]);

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
    <Card
      ref={container}
      className="w-full bg-white shadow-lg rounded-lg overflow-x-scroll mx-auto"
    >
      <ApplicationDragProvider
        draggedApplications={draggedApplications}
        setDraggedApplications={setDraggedApplications}
        container={container}
        dragEndCallback={(record: GroupRecord, target?: HTMLElement) => {
          if (
            target?.closest("tbody")?.attributes.getNamedItem("data-row")
              ?.value === record.id
          )
            return;
          setDraggedApplications((prev) => [...prev, record]);
        }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b-[1px] border-slate-200 text-slate-400 text-xs uppercase h-9">
              <th className="pl-3 w-12"></th>
              <th className="pl-7 text-start font-medium w-sm">Company</th>
              <th className="text-start font-medium">Status</th>
              <th className="text-start font-medium">Last Subject</th>
            </tr>
          </thead>

          <AnimatePresence>
            {displayedApplications.map((application, index) => {
              return (
                <TableRow
                  key={application.id}
                  applicationRecord={application}
                  index={index}
                  shift={shift}
                  onEditToggle={(edit) => {
                    !edit && setDraggedApplications([]);
                  }}
                />
              );
            })}
          </AnimatePresence>
        </table>
      </ApplicationDragProvider>
    </Card>
  );
};

export default ApplicationList;
