import { useDashboard } from "@/components/providers/DashboardProvider";
import { ApplicationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditInput } from "@/components/ui/edit-input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import TimelineBreadCrumbs from "@/components/ui/timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { flushSync } from "react-dom";
import { createRoot, Root } from "react-dom/client";
import useSWR from "swr";
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
  shift,
  onEditToggle,
  ...props
}: {
  applicationRecord: GroupRecord;
  index: number;
  shift: (id: string, direction: "up" | "down") => void;
  onEditToggle?: (edit: boolean) => void;
}) => {
  const {
    data: applicationRecord,
    mutate,
    isLoading,
    isValidating,
  } = useSWR(
    `/api/applications/${applicationRecordFallback.id}`,
    (e) =>
      fetch(e)
        .then((res) => res.json() as Promise<{ data: GroupRecord }>)
        .then(
          ({ data }) =>
            ({ ...applicationRecordFallback, ...data }) as GroupRecord
        ),
    {
      applicationRecordFallback,
      revalidateOnMount: false,
    }
  );
  const [application, setApplication] = useState<GroupRecord>(
    applicationRecord || applicationRecordFallback
  );
  const [mergingApplications, setMergingApplications] = useState<GroupRecord[]>(
    []
  );
  const editDataRef = useRef<Partial<GroupRecord>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [expand, setExpand] = useState<boolean>(false);
  const [edit, setEdit] = useState(false);
  const ghostNode = useRef<HTMLElement | null>(null);
  const rootRef = useRef<Root>(null);
  const rowGroupRef = useRef<HTMLTableSectionElement>(null);
  const { setEmails, setApplications } = useDashboard();

  const displayData: GroupRecord = {
    ...application,
    ...(edit ? editDataRef.current : {}),
  };

  console.log("Display Data", displayData);
  console.log({ applicationRecord });

  const { draggedData, isDragging, draggedApplications } =
    useApplicationDragContext();

  const cleanupGhost = () => {
    if (ghostNode.current) {
      ghostNode.current.remove();
      ghostNode.current = null;
    }
    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!ghostNode.current) return;
    const el = ghostNode.current;
    e.dataTransfer.setDragImage(el, -10, -10);
    e.dataTransfer.clearData();
    e.dataTransfer.setData("text/plain", JSON.stringify(application));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cleanupGhost();
      });
    });
  }, []);

  const onMouseOver = async () => {
    const ghost = document.createElement("div");
    const root = createRoot(ghost);

    flushSync(() => {
      root.render(Preview); // <- React will immediately render this to ghost
    });

    Object.assign(ghost.style, {
      position: "absolute",
      top: "-1000px", // off-screen
      left: "-1000px",
    });

    ghost.classList.add("drag-preview");

    document.body.appendChild(ghost);
    ghost.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(r));

    const img = ghost.querySelector("img");

    function waitForImageLoad(
      img: HTMLImageElement
    ): Promise<HTMLImageElement | void> {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth !== 0) {
          resolve(img);
        } else {
          img.onload = () => resolve(img);
          img.onerror = () => resolve(); // Prevent hang
        }
      });
    }
    await waitForImageLoad(img as HTMLImageElement).then((img) => {
      ghostNode.current = ghost;
      rootRef.current = root;
    });
  };

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
          console.log(key);
          console.log(groupRecord.email_ids);
          console.log(displayData.email_ids);
          const newValues =
            groupRecord.email_ids[key as ApplicationStatus] || [];
          const currentValues =
            displayData.email_ids[key as ApplicationStatus] || [];
          const appStatus = Array.from(
            new Set([...newValues, ...currentValues])
          );
          console.log("appStatus", appStatus);
          console.log(newValues, currentValues);
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
    editDataRef.current = mergeGroupRecord(data);
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

  const toggleDrag = (toggleValue: boolean) => (e: React.DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget as HTMLElement | null;
    if (
      !rowGroupRef.current ||
      rowGroupRef.current?.contains(related) !== toggleValue
    ) {
      return;
    }
    if (!draggedData.current) return;
  };

  const onDragEnter = debounce(toggleDrag(true), 100, {
    immediate: true,
  });

  const onDragLeave = debounce(toggleDrag(false), 100, {
    immediate: true,
  });

  const submitChanges = async (
    changes: Partial<GroupRecord>,
    finalize?: boolean
  ) => {
    let submittingChanges = {
      ...changes,
      id: editDataRef.current.id || application.id,
    };
    console.log("Submitting changes", submittingChanges);
    editDataRef.current = {
      ...editDataRef.current,
      ...submittingChanges,
    };
    return debouncedSubmitChanges(!!finalize, changes);
  };

  const debouncedSubmitChanges = debounce(async (
    finalize: boolean,
    changes: Partial<GroupRecord>
  ) => {
    const fullChanges = {
      ...editDataRef.current,
      ...changes,
    };
    if (Object.values(fullChanges).length === 0) {
      return;
    }
    let optimistic = {
      ...application,
      ...fullChanges,
    };

    setIsUpdating(true);
    return mutate(
      async (currentData) => {
        const res = await fetch("/api/applications", {
          method: "POST",
          body: JSON.stringify({
            application: fullChanges,
            deletedApplications: finalize
              ? draggedApplications.map((a) => a.id)
              : null,
          }),
        });

        if (!res.ok) throw new Error("Failed to update: " + res.statusText);

        const { data: updatedFields } = await res.json();

        const resultRecord = {
          ...currentData,
          ...updatedFields,
        } as GroupRecord;

        if (draggedApplications && finalize) {
          setApplications((prev) => {
            return [
              ...prev.filter((app) => {
                return !draggedApplications.find((d) => d.id === app.id);
              }),
            ];
          });
        }
        if (resultRecord.email_ids) {
          const emailIdsArray: string[] = Object.entries(
            resultRecord.email_ids
          ).reduce((acc, [_, ids]) => {
            return acc.concat(ids);
          }, [] as string[]);
          setEmails((prev) => {
            prev.forEach((email) => {
              if (emailIdsArray.includes(email.id)) {
                console.log("Updating email group_id", email.id, resultRecord);
                email.group_id = resultRecord.id;
                email.company_title = resultRecord.company_title;
                email.job_title = resultRecord.job_title;
              }
            });
            return [...prev];
          });
        }

        setApplication(resultRecord);

        setIsUpdating(false);
        return resultRecord;
      },
      {
        optimisticData: optimistic,
        rollbackOnError: true,
        revalidate: false, // prevents extra GET fetch
        populateCache: true,
      }
    );
  }, 1000);

  useEffect(() => {
    onEditToggle?.(edit);
  }, [edit]);

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

  const Timeline = useCallback(() => {
    return (
      <div
        className={cn(
          "flex flex-col flex-1 gap-2.5 h-fit py-5",
          mergingApplications.length > 0 ? "pt-1" : "pt-5"
        )}
      >
        <TimelineBreadCrumbs
          expand
          applicationData={displayData}
          editMode={edit}
        />
        <AnimatePresence>
          {edit && (
            <motion.div
              layout={"position"}
              key={`edit-${application.id}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex gap-2 justify-start"
              )}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  submitChanges(editDataRef.current, true)
                    .then(() => {
                      setMergingApplications([]);
                      editDataRef.current = {};
                      setApplication({ ...application, ...displayData });
                      setEdit(false);
                    })
                    .catch((err) => {
                      console.error("Failed to submit changes", err);
                    });
                }}
              >
                Save
                {isUpdating || isValidating || isLoading ? (
                  <Spinner />
                ) : (
                  <Check />
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMergingApplications([]);
                  setEdit(false);
                  editDataRef.current = {};
                  submitChanges(applicationRecordFallback);
                }}
              >
                Cancel Edit
                <Undo2 />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }, [edit, displayData]);

  return (
    <motion.tbody
      data-row={application.id}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
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
        className={`text-sm ${index % 2 ? "bg-slate-100" : "bg-white"}`}
        onClick={toggleExpand}
      >
        <td className="pl-3 flex items-center gap-3 relative w-min">
          <div className="flex flex-col items-center justify-center gap-2 w-6">
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
              onSubmit={() => submitChanges(editDataRef.current)}
              onBlur={() => edit && submitChanges(editDataRef.current)}
              onValueChange={(val) => {
                editDataRef.current = {
                  ...editDataRef.current,
                  company_title: val,
                };
              }}
            />
            <EditInput
              key={`job-${application.id}`}
              className="text-xs text-slate-500 max-w-2xs w-max"
              edit={edit}
              value={displayData.job_title}
              onSubmit={() => submitChanges(editDataRef.current)}
              onBlur={() => edit && submitChanges(editDataRef.current)}
              onValueChange={(val) => {
                editDataRef.current = {
                  ...editDataRef.current,
                  job_title: val,
                };
              }}
              isTextArea
            />
          </div>
        </td>
        <td className="py-5 pr-3">
          {displayData.last_status && (
            <ApplicationBadge status={displayData.last_status} />
          )}
        </td>

        <td className="py-5 pr-5 text-ellipsis flex flex-grow items-center justify-between text-start font-medium gap-5">
          <div className="">
            <p className="block font-medium">
              {displayData.last_email_subject}
            </p>
            <p className="block text-xs text-slate-500">
              {displayData.last_updated
                ? timeAgo(displayData.last_updated)
                : null}
            </p>
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
        className={`${index % 2 ? "bg-slate-100" : "bg-white"} ${expand ? "border-t-1" : ""}`}
      >
        <motion.td colSpan={4}>
          <motion.div
            initial={{ maxHeight: 0 }}
            animate={{ maxHeight: expand ? 280 : 0 }}
            exit={{ maxHeight: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col overflow-y-scroll overflow-x-hidden gap-0.5 text-xs text-zinc-600 dark:text-white w-full px-15"
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
            <Timeline />
          </motion.div>
        </motion.td>
      </motion.tr>
    </motion.tbody>
  );
};
