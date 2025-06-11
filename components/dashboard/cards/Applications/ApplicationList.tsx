import { composeDashboardData } from "@/app/(actions)/composeDashboard";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Card } from "@/components/ui/card";
import {
  PaginationItem as BasePaginationItem,
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { MAX_APPLICATION_PAGE_SIZE } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { GroupRecord } from "@/types";
import { AnimatePresence } from "motion/react";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { TableRow } from "./ApplicationRow";
import { ApplicationDragProvider } from "./provider";

const ApplicationList = () => {
  const { applications, setApplications, params, maxApplications, setParams } =
    useDashboard();
  const container = useRef<HTMLDivElement>(null);
  const [loadedApplications, setLoadedApplications] =
    useState<GroupRecord[]>(applications);
  const [draggedApplications, setDraggedApplications] = useState<GroupRecord[]>(
    []
  );
  const page = params.applicationPageIndex || 0;
  const [sortKey, setSortKey] = useState<{
    sortFunc?: (r1: GroupRecord, r2: GroupRecord) => number;
    key?: keyof GroupRecord;
  }>({ key: "company_title" });

  useEffect(() => {
    const uniqueApps = applications.filter((a) => {
      return !loadedApplications.find((la) => la.id === a.id);
    });
    console.log({ uniqueApps, applications, loadedApplications });
    setLoadedApplications(Array.from([...loadedApplications, ...uniqueApps]));
  }, [applications]);

  useEffect(() => {
    composeDashboardData(params, true).then((data) => {
      setApplications(data.applications || []);
      maxApplications.current = data.maxApplications ?? 1;
    });
  }, [params]);

  const shift = (id: string, direction: "up" | "down") => {
    const index = loadedApplications.findIndex((u) => u.id === id);
    let applicationsCopy = [...loadedApplications];

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

  const useSortKey = ({
      key,
      sortFunc,
    }: {
      key?: keyof GroupRecord;
      sortFunc?: (r1: GroupRecord, r2: GroupRecord) => number;
    }) =>
    (a: GroupRecord, b: GroupRecord) => {
      if (sortFunc) {
        return sortFunc(a, b);
      }
      if (key) {
        if (a[key] === undefined || b[key] === undefined) return 0;
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
      }
      return 0;
    };

  const PaginationItem = ({
    className,
    ...props
  }: ComponentProps<typeof BasePaginationItem>) => {
    return (
      <BasePaginationItem
        className={cn(
          "w-full font-[inherit] text-xs text-start uppercase",
          className
        )}
        {...props}
      />
    );
  };

  const firstIndex = page * MAX_APPLICATION_PAGE_SIZE;
  const lastIndex = Math.min(
    (page + 1) * MAX_APPLICATION_PAGE_SIZE,
    maxApplications.current
  );

  const displayedApplications = loadedApplications
    .slice(firstIndex, lastIndex)
    .filter(
      (a) =>
        draggedApplications.length === 0 ||
        !draggedApplications.find((d) => d.id === a.id)
    );

  const Pages = () => {
    const maxPages = Math.ceil(
      maxApplications.current / MAX_APPLICATION_PAGE_SIZE
    );

    return (
      <div className="text-start font-medium bg-card">
        <Pagination>
          <PaginationContent>
            <span className="w-full text-nowrap normal-case">{`${firstIndex + 1} - ${lastIndex} of ${maxApplications.current}`}</span>
            <PaginationItem>
              <PaginationPrevious
                size="icon"
                className={cn(
                  "w-full font-[inherit] uppercase [font-size:inherit]"
                )}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationButton
                className={cn(
                  "font-[inherit] uppercase [font-size:inherit]"
                )}
              >
                1
              </PaginationButton>
            </PaginationItem>
            {(page > 1 || maxPages > 2) && (
              <PaginationItem>
                <PaginationEllipsis
                  className={cn(
                    "font-[inherit] uppercase [font-size:inherit]"
                  )}
                />
              </PaginationItem>
            )}

            {page > 1 && page < maxPages && (
              <PaginationItem>
                <PaginationButton
                  className={cn(
                    "font-[inherit] uppercase [font-size:inherit]"
                  )}
                >
                  {page}
                </PaginationButton>
              </PaginationItem>
            )}

            {page !== 0 && maxPages - page > 1 && (
              <PaginationItem>
                <PaginationEllipsis
                  className={cn(
                    "font-[inherit] uppercase [font-size:inherit]"
                  )}
                />
              </PaginationItem>
            )}

            {maxPages > 1 && (
              <PaginationItem>
                <PaginationButton
                  className={cn(
                    "font-[inherit] uppercase [font-size:inherit]"
                  )}
                >
                  {maxPages}
                </PaginationButton>
              </PaginationItem>
            )}

            <PaginationItem>
              <PaginationNext
                size="icon"
                className={cn(
                  "w-full font-[inherit] uppercase [font-size:inherit]"
                )}
                onClick={() => {
                  setParams((prev) => ({
                    ...prev,
                    applicationPageIndex: (prev.applicationPageIndex || 0) + 1,
                  }));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <Card
      ref={container}
      className="w-full bg-white shadow-lg rounded-lg overflow-x-scroll mx-auto h-[540px] relative"
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
          <thead className="border-b-[1px] border-slate-200 text-slate-400 text-xs uppercase h-9 sticky top-0 bg-card z-50 w-full font-medium">
            <tr>
              <th className="pl-7 text-start font-medium">Company</th>
              <th className="text-start font-medium">Status</th>
              <th
                colSpan={0}
                className="flex flex-grow items-center justify-between text-start font-medium min-w-max"
              >
                <span className="text-nowrap">Last Subject</span>
                <Pages />
              </th>
            </tr>
          </thead>

          <AnimatePresence>
            {displayedApplications
              .sort((a, b) => useSortKey(sortKey)(a, b))
              .map((application, index) => {
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
