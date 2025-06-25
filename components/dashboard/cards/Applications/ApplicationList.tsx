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
import { ComponentProps, useEffect, useMemo, useRef, useState } from "react";
import { TableRow } from "./ApplicationRow";
import { ApplicationDragProvider } from "./provider";

const sortKeyFunctions: Partial<
  Record<keyof GroupRecord, (r1: GroupRecord, r2: GroupRecord) => number>
> = {
  last_updated: (r1, r2) => {
    if (r1.last_updated === undefined || r2.last_updated === undefined)
      return 0;
    return (
      new Date(r1.last_updated).getTime() - new Date(r2.last_updated).getTime()
    );
  },
};

const ApplicationList = () => {
  const { applications: applicationsSWR, params, setParams } = useDashboard();
  const container = useRef<HTMLDivElement>(null);
  const [loadedApplications, setLoadedApplications] = useState<GroupRecord[]>(
    applicationsSWR.data ?? []
  );
  const [draggedApplications, setDraggedApplications] = useState<GroupRecord[]>(
    []
  );
  const page = params.applicationPageIndex || 0;

  const maxApplications = useRef(applicationsSWR.maxApplications || 0);

  useEffect(() => {
    setLoadedApplications(Array.from([...(applicationsSWR.data ?? [])]));
    maxApplications.current = applicationsSWR.maxApplications || 0;
  }, [applicationsSWR.data]);

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

  const displayedApplications = useMemo(() => {
    return [
      ...loadedApplications.filter(
        (a) =>
          draggedApplications.length === 0 ||
          !draggedApplications.find((d) => d.id === a.id)
      ),
    ];
  }, [loadedApplications, draggedApplications, params.applicationSortKey]);

  const Pages = () => {
    const maxPages = Math.ceil(
      maxApplications.current / MAX_APPLICATION_PAGE_SIZE
    );

    const PageButton = ({ page }: { page: number }) => (
      <PaginationItem>
        <PaginationButton
          className={cn(
            "font-[inherit] uppercase [font-size:inherit] px-1",
            { "bg-accent/70": page === (params.applicationPageIndex ?? 0) + 1 }
          )}
          onClick={() => {
            setParams((prev) => ({
              ...prev,
              applicationPageIndex: page - 1,
            }));
          }}
        >
          {page}
        </PaginationButton>
      </PaginationItem>
    );

    const PageEllipsis = () => (
      <PaginationItem>
        <PaginationEllipsis
          className={cn(
            "w-auto font-[inherit] uppercase [font-size:inherit] px-0.5"
          )}
        />
      </PaginationItem>
    );

    return (
      <div className="text-start font-medium bg-card">
        <Pagination>
          <PaginationContent>
            <span className="w-full text-nowrap normal-case px-1">{`${firstIndex + 1} - ${lastIndex} of ${maxApplications.current}`}</span>
            <PaginationItem>
              <PaginationPrevious
                size="icon"
                className={cn(
                  "w-full font-[inherit] uppercase"
                )}
                disabled={page <= 0}
              />
            </PaginationItem>
            <PageButton page={1} />
            {(page > 1 || maxPages > 2) && <PageEllipsis />}
            {page > 1 && page < maxPages && <PageButton page={page} />}
            {page !== 0 && maxPages - page > 1 && <PageEllipsis />}
            {maxPages > 1 && <PageButton page={maxPages} />}
            <PaginationItem>
              <PaginationNext
                size="icon"
                className={cn(
                  "w-full font-[inherit] uppercase"
                )}
                disabled={page >= maxPages - 1}
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
          <thead className="border-b-[1px] border-slate-200 text-slate-400 text-xs uppercase h-9 sticky top-0 bg-card z-40 w-full font-medium">
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
            {displayedApplications.map((application, index) => {
              return (
                <TableRow
                  key={application.id}
                  applicationRecord={application}
                  index={index}
                  isFetching={
                    applicationsSWR.isLoading && applicationsSWR.presorted
                  }
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
