import { useDashboard } from "@/components/providers/DashboardProvider";
import { ApplicationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditInput } from "@/components/ui/edit-input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import TimelineBreadCrumbs from "@/components/ui/timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDragPreview } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { ApplicationStatus, Group, GroupRecord } from "@/types";
import debounce from "debounce";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Plus,
  Undo2,
} from "lucide-react";
import {
  ComponentPropsWithoutRef,
  ComponentRef,
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeleteItemModal } from "../../DeleteItemModal";
import { LogoAvatar } from "../../LogoAvatar";
import { useApplicationDragContext } from "./provider";

const PreviewBody = forwardRef<
  ComponentRef<"div">,
  ComponentPropsWithoutRef<"div"> & {
    application: GroupRecord;
    avatar: ReactNode;
  }
>(({ application, avatar, ...props }, ref) => {
  return (
    <div
      className="flex items-center gap-3 relative shrink w-min pl-3 rounded-md min-w-sm "
      {...props}
    >
      <div className="py-5">{avatar}</div>
      <div className="space-y-1">
        <div className="space-y-0.5">
          <div className="flex font-medium space-x-0.5 items-end">
            <p className="text-base/tight">{application.company_title}</p>
            <span>
              {application.last_status && (
                <ApplicationBadge
                  status={application.last_status}
                  className="ml-2"
                />
              )}
            </span>
          </div>

          <div className="text-xs text-slate-500 w-max max-w-2xs ">
            {application.job_title}
          </div>

          <Separator orientation="horizontal" />
        </div>
        <div className="text-ellipsis">
          <p className="block text-sm text-slate-700 font-light">
            {application.last_email_subject}
          </p>
          <p className="block text-xs text-slate-400">
            {application.last_updated
              ? timeAgo(application.last_updated)
              : null}
          </p>
        </div>
      </div>
    </div>
  );
});

export const TableRow = ({
  applicationRecord: applicationRecordFallback,
  index,
  onEditToggle,
  isFetching = true,
  ...props
}: {
  applicationRecord: GroupRecord;
  index: number;
  isFetching?: boolean;
  onEditToggle?: (edit: boolean) => void;
}) => {
  const { emails: emailSWR, applications: applicationSWR } = useDashboard();

  const [application, setApplication] = useState<GroupRecord>(
    applicationRecordFallback
  );
  const [mergingApplications, setMergingApplications] = useState<GroupRecord[]>(
    []
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [expand, setExpand] = useState<boolean>(false);
  const [edit, setEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const rowGroupRef = useRef<HTMLTableSectionElement>(null);
  const [editData, setEditData] = useState<Partial<GroupRecord>>({});

  const displayData: GroupRecord = {
    ...application,
    ...(edit ? editData : {}),
  };

  const { draggedData, isDragging, draggedApplications } =
    useApplicationDragContext();

  const Avatar = useMemo(() => {
    return (
      <LogoAvatar
        company={application.company_title}
        size={48}
        loading="eager"
      />
    );
  }, [application.company_title]);

  const Preview = useMemo(
    () => <PreviewBody application={application} avatar={Avatar} />,
    [application]
  );

  const {
    onMouseOver,
    handleDragStart: addDragPreview,
    cleanupGhost,
  } = useDragPreview(Preview);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(application));
      addDragPreview(e);
    },
    [application]
  );

  const mergeGroupRecord = (groupRecord: GroupRecord): GroupRecord => {
    const { last_email_subject, last_status, last_updated } =
      new Date(displayData.last_updated ?? 0) >
      new Date(groupRecord.last_updated ?? 0)
        ? application
        : groupRecord;
    const newGroupRecord = {
      ...groupRecord,
      id: displayData.id,
      company_title: displayData.company_title,
      job_title: displayData.job_title,
      last_email_subject,
      last_status,
      last_updated,
      email_ids: Object.values(ApplicationStatus).reduce(
        (acc, key) => {
          const newValues =
            groupRecord.email_ids[key as ApplicationStatus] || [];
          const currentValues =
            displayData.email_ids[key as ApplicationStatus] || [];
          const appStatus = Array.from(
            new Set([...newValues, ...currentValues])
          );
          if (appStatus.length) {
            acc[key as ApplicationStatus] = appStatus;
          }
          return acc;
        },
        {} as Group<ApplicationStatus, string[]>
      ),
    } as GroupRecord;
    return newGroupRecord;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = JSON.parse(
      e.dataTransfer.getData("text/plain")
    ) as GroupRecord;
    const target = e.target as HTMLElement;
    if (
      target?.closest("tbody")?.attributes.getNamedItem("data-row")?.value ===
      data.id
    )
      return;
    setMergingApplications((prev) => {
      return [...prev, data];
    });
    setEditData(mergeGroupRecord(data));
    setEdit(true);
    setExpand(true);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, textarea, select, [data-no-drawer], [role=menuitem], [role=menu], [role=button], [role=tab], [role=treeitem], [role=option], [role=input]"
      ) // opt-out selector
    ) {
      return;
    } else {
      setExpand((prev) => !prev);
      setEdit(false);
      setMergingApplications([]);
    }
  };

  const submitChanges = async (
    changes: Partial<GroupRecord>,
    finalize?: boolean
  ) => {
    let submittingChanges = {
      ...changes,
      id: editData.id || application.id,
    };
    setEditData({
      ...editData,
      ...submittingChanges,
    });

    setIsUpdating(true);
    return debouncedSubmitChanges(!!finalize, changes);
  };

  const debouncedSubmitChanges = debounce(async (
    finalize: boolean,
    changes: Partial<GroupRecord>
  ) => {
    if (!finalize) {
      setIsUpdating(false);
      return;
    }

    const fullChanges = {
      id: editData.id || application.id,
      ...editData,
      ...changes,
    };
    if (Object.values(fullChanges).length === 0) {
      return;
    }

    let optimisticRecord = {
      ...application,
      ...fullChanges,
    };

    const currentRecordIdx = applicationSWR.data?.findIndex(
      (g) => g.id === application.id
    );
    const optimistic = applicationSWR.data ? [...applicationSWR.data] : [];
    if (currentRecordIdx) {
      optimistic[currentRecordIdx] = optimisticRecord;
    }

    return applicationSWR
      .mutate(
        async (currentData) => {
          const res = await fetch("/api/application", {
            method: "POST",
            body: JSON.stringify({
              application: fullChanges,
              deletedApplications: finalize
                ? draggedApplications.map((a) => a.id)
                : null,
            }),
          });

          if (!res.ok) throw new Error("Failed to update: " + res.statusText);

          const { data } = await res.json();
          const updatedFields: Partial<GroupRecord> = {
            ...data.Attributes,
          };
          let currentRecord = currentRecordIdx
            ? currentData?.[currentRecordIdx]
            : application;
          const resultRecord = {
            ...currentRecord,
            ...updatedFields,
          } as GroupRecord;

          if (resultRecord.email_ids) {
            const emailIdsArray: string[] = Object.entries(
              resultRecord.email_ids
            ).reduce((acc, [_, ids]) => {
              return acc.concat(ids);
            }, [] as string[]);
            await emailSWR.mutate(
              (prev) => {
                const newEmails =
                  prev?.emails?.map((email) => {
                    if (emailIdsArray.includes(email.id)) {
                      email.group_id = resultRecord.id;
                      email.company_title = resultRecord.company_title;
                      email.job_title = resultRecord.job_title;
                    }
                    return email;
                  }) ?? [];
                return prev ? { ...prev, emails: newEmails } : prev;
              },
              {
                rollbackOnError: true,
                revalidate: false, // prevents extra GET fetch
                populateCache: true,
              }
            );
          }

          setApplication(resultRecord);

          if (currentData && currentRecordIdx) {
            currentData[currentRecordIdx] = resultRecord;
          }
          if (draggedApplications) {
            currentData = currentData
              ? [
                  ...currentData.filter((app) => {
                    return !draggedApplications.find((d) => d.id === app.id);
                  }),
                ]
              : currentData;
          }
          return currentData ? [...currentData] : currentData;
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: false, // prevents extra GET fetch
          populateCache: true,
        }
      )
      .then((data) => {
        setApplication({ ...optimisticRecord });
      })
      .catch((err) => {
        console.error("Failed to submit changes", err);
        setApplication({ ...applicationRecordFallback });
      })
      .finally(() => {
        setIsUpdating(false);
        setMergingApplications([]);
        setEdit(false);
        setEditData({});
      });
  }, 1000);

  const DeleteDialog = ({
    open,
    setOpen,
  }: {
    open: boolean;
    setOpen: (open: boolean) => void;
  }) => {
    const [cascadeDelete, setCascade] = useState(false);
    const description = (
      <>
        <span>
          Are you sure you want to delete this item? This action cannot be
          undone.
        </span>
        <span className="p-3 pb-0 flex gap-1 items-center">
          <Checkbox
            checked={cascadeDelete}
            onCheckedChange={(v) => setCascade(!!v)}
          />
          Delete associated emails?
        </span>
      </>
    );
    return (
      <DeleteItemModal
        open={open}
        setOpen={setOpen}
        onConfirm={() => deleteApplication()}
        description={description}
      />
    );
  };

  const deleteApplication = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/application", {
        method: "DELETE",
        body: JSON.stringify({ application: { id: application.id } }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete application: " + res.statusText);
      }
      const { data: deletedApplication } = await res.json();
      applicationSWR.mutate((prev) =>
        prev?.filter((app) => app.id !== deletedApplication.id));
      setIsUpdating(false);
    } catch (error) {
      console.error("Error deleting application:", error);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!isFetching) {
      setApplication({ ...applicationRecordFallback });
    }
  }, [applicationRecordFallback, isFetching]);

  useEffect(() => {
    onEditToggle?.(edit);
  }, [edit]);

  const Timeline = useCallback(
    ({
      id,
      email_ids,
      edit,
      expand,
      children,
    }: Pick<GroupRecord, "id" | "email_ids"> & {
      expand: boolean;
      edit: boolean;
      children?: ReactNode;
    }) => {
      return (
        <div
          className={cn(
            "flex flex-col flex-1 h-fit py-5",
            mergingApplications.length > 0 ? "pt-1" : "pt-5"
          )}
        >
          <TimelineBreadCrumbs
            expand={expand}
            id={id}
            emailIds={email_ids}
            editMode={edit}
          />
          {children}
        </div>
      );
    },
    [mergingApplications]
  );

  return (
    <motion.tbody
      data-row={application.id}
      onDragOverCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnterCapture={(e) => {
        e.preventDefault();
      }}
      onDrop={handleDrop}
      ref={rowGroupRef}
      layoutId={`body-${application.id}`}
      layout="size"
      {...props}
    >
      <motion.tr
        draggable
        onMouseEnter={onMouseOver}
        onMouseLeave={cleanupGhost}
        onDragStart={handleDragStart}
        onDrag={(e) => {
          e.preventDefault();
        }}
        layoutId={`row-${application.id}`}
        className={`text-sm ${index % 2 ? "bg-slate-50" : "bg-white"}`}
        onClick={toggleExpand}
      >
        <td className="pl-3 flex items-center gap-3 relative pr-5">
          <div className="flex flex-col items-center justify-center gap-2 w-6">
            <button className="hover:text-violet-600">
              <ChevronUp />
            </button>
            <button className="hover:text-violet-600">
              <ChevronDown />
            </button>
          </div>
          <div className="relative my-5 ">
            {Avatar}
            <AnimatePresence>
              {isDragging &&
                draggedData.current &&
                (draggedData.current as GroupRecord).id !== application.id && (
                  <motion.div
                    className="absolute -bottom-2 -right-2 rounded-full border-accent border-2 bg-card"
                    initial={{ width: 0, height: 0, opacity: 0 }}
                    animate={{
                      width: 24,
                      height: 24,
                      opacity: 1,
                    }}
                    exit={{ width: 0, height: 0, opacity: 0 }}
                  >
                    <Plus className="text-accent" size={20} />
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
          <div>
            <EditInput
              key={`title-${application.id}`}
              className="block font-medium"
              edit={edit}
              value={displayData.company_title}
              onValueChange={(val) => {
                setEditData({
                  ...editData,
                  company_title: val,
                });
              }}
              validateValue={(val) => {
                return val.length < 0;
              }}
            />
            <EditInput
              key={`job-${application.id}`}
              className="text-xs text-slate-500 max-w-2xs w-max"
              edit={edit}
              value={displayData.job_title}
              onValueChange={(val) => {
                setEditData({
                  ...editData,
                  job_title: val,
                });
              }}
              isTextArea
            />
          </div>
        </td>
        <td className="h-min py-5 pr-3 align-middle">
          <div className="h-min w-min align-middle">
            <ApplicationBadge
              status={displayData.last_status}
              isLoading={isFetching}
            />
          </div>
        </td>

        <td className="py-5 pr-5 text-ellipsis flex flex-grow items-center justify-between text-start font-medium gap-5 align-middle">
          <div className="flex flex-col align-middle">
            {isFetching ? (
              <Skeleton className="w-60 h-5" />
            ) : (
              <p>{displayData.last_email_subject}</p>
            )}

            {isFetching ? (
              <Skeleton className="w-20 h-4 mt-2" />
            ) : (
              <p className="block text-xs text-slate-500">
                {displayData.last_updated
                  ? timeAgo(displayData.last_updated)
                  : null}
              </p>
            )}
          </div>
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
            <DropdownMenuContent
              className="z-80 w-40 border-zinc-200 dark:border-zinc-800"
              align="end"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={(e) => {
                    setEdit(!edit);
                    setExpand(true);
                    setMergingApplications([]);
                  }}
                >
                  <p className="flex cursor-pointer items-center gap-2 text-zinc-800 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                    <span>{/* <User /> */}</span>
                    Edit
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    requestAnimationFrame(() => setOpenDelete(true));
                  }}
                >
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
        className={`${index % 2 ? "bg-slate-50" : "bg-white"} ${expand ? "border-t-1" : ""}`}
      >
        <motion.td colSpan={4}>
          <div className="flex">
            <motion.div
              initial={{ maxHeight: 0 }}
              animate={{ maxHeight: expand ? 280 : 0 }}
              exit={{ maxHeight: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex flex-1 flex-col gap-0.5 w-full", // Layout, Flexbox & Grid, Sizing
                "text-xs text-zinc-600 dark:text-white overflow-y-scroll", // Typography, Etc.
                "overflow-x-hidden px-15"
              )}
              layout="size"
            >
              {mergingApplications.length > 0 && (
                <motion.div className={"flex gap-5 px-15 pt-5 items-center"}>
                  <p className="italic text-slate-500 ">Merging...</p>
                  <div className="flex gap-1">
                    <TooltipProvider>
                      {mergingApplications.map((app) => (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <LogoAvatar company={app.company_title} size={24} />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={10}
                            className={cn(
                              "flex p-3 rounded-lg border-2 border-accent"
                            )}
                            variant={"card"}
                          >
                            <PreviewBody
                              application={app}
                              avatar={
                                <LogoAvatar
                                  company={app.company_title}
                                  size={48}
                                  loading="eager"
                                />
                              }
                            />
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                </motion.div>
              )}
              <Timeline
                edit={edit}
                expand={expand}
                id={displayData.id}
                email_ids={displayData.email_ids}
              >
                <AnimatePresence>
                  {edit && (
                    <motion.div
                      layout={"position"}
                      key={`edit-${application.id}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "flex gap-2 justify-start pt-5"
                      )}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsUpdating(true);
                          submitChanges(editData, true);
                        }}
                        disabled={
                          [...Object.values(editData)].length === 0 ||
                          isUpdating
                        }
                      >
                        Save
                        {isUpdating ? <Spinner /> : <Check />}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setMergingApplications([]);
                          setEdit(false);
                          setEditData({});
                          setApplication(applicationRecordFallback);
                        }}
                      >
                        Cancel Edit
                        <Undo2 />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Timeline>
            </motion.div>
            <motion.div className="bg-black w-10"></motion.div>
          </div>
        </motion.td>
      </motion.tr>
      <DeleteDialog open={openDelete} setOpen={setOpenDelete} />
    </motion.tbody>
  );
};
