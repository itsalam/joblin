import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

import { cn, timeAgo } from "@/lib/utils";
import { ApplicationStatus, GroupRecord } from "@/types";
import { Variants, motion } from "framer-motion";
import { Ban, Check, PenLine, PlusCircle } from "lucide-react";
import { ComponentProps, FC } from "react";
import { BreadcrumbTooltip } from "./breadcrumb-tooltip";

export type BreadCrumbItemProps = {
  applicationData: GroupRecord;
  external_id?: string;
  editMode: boolean;
  isLast?: boolean;
  isLoading: boolean;
  index: number;
  currStatusIndex: number;
  status: ApplicationStatus;
  date?: string;
  startColor?: string;
  endColor?: string;
};

type MotionCustomProps = {
  index: number;
  currStatusIndex: number;
  isLine?: boolean;
};

export const CIRCLE_DURATION = 0.02;
export const LINE_DURATION = 0.01;

const draw = {
  hover: ({ isLine }: MotionCustomProps) => ({
    scale: isLine ? 0.95 : 1.2,
  }),

  hidden: { pathLength: [null, 0], opacity: [null, 0] },
  visible: ({ index, currStatusIndex, isLine }: MotionCustomProps) => {
    const delay =
      0.1 + index * (0.05 + CIRCLE_DURATION) + (isLine ? CIRCLE_DURATION : 0);
    return {
      pathLength: [null, 1],
      opacity: [null, 1],
      transition: {
        pathLength: {
          delay: delay,
          duration: isLine ? LINE_DURATION : CIRCLE_DURATION,
        },
        opacity: { delay, duration: 0.3 },
      },
    };
  },
} as Variants;

export const BreadCrumbItem: FC<BreadCrumbItemProps> = (props) => {
  const {
    editMode,
    applicationData,
    external_id,
    isLast = true,
    isLoading,
    index,
    currStatusIndex,
    status,
    date,
    startColor,
    endColor,
  } = props;
  // const setEditingStatus = useApplicationStore(
  //   (store) => store.setEditingStatus
  // );

  const crossOrCheck = status === ApplicationStatus.Rejected;

  const EditIcon = motion(
    currStatusIndex >= index ? PenLine : PlusCircle
  );
  const CrumbIcon = crossOrCheck ? motion(Ban) : motion(Check);

  const onClick = () => {
      // setEditingStatus(status);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.li
          whileHover={"hover"}
          style={{
            color: startColor,
          }}
          onClick={onClick}
          className={cn(
            "flex relative flex-col flex-1 gap-4 items-center", // Layout, Flexbox & Grid
            "max-w-24 group", // Sizing, Etc.
            {
              "cursor-default": !editMode,
              "cursor-pointer": editMode || external_id,
              "animate-pulse": isLoading,
              "pointer-events-none":
                !(external_id) &&
                !editMode,
            }
          )}
          transition={{
            staggerChildren: CIRCLE_DURATION,
          }}
        >
          <motion.div
            className={cn(
              "flex relative justify-center items-center w-full"
            )}
          >
            {editMode ? (
              <EditIcon
                className="absolute z-20 text-white"
                size={currStatusIndex >= index ? 16 : 20}
                strokeWidth={2}
                fill="currentColor"
                variants={{ hover: { scale: 1.1 }, initial: { scale: 1.0 } }}
              />
            ) : index > currStatusIndex ? null : (
              <CrumbIcon
                className="absolute z-20 text-white"
                strokeWidth={3}
                fill="currentColor"
                variants={{ hover: { scale: 1.1 } }}
              />
            )}
            <motion.svg
              className={cn(
                "overflow-visible relative z-10 justify-center items-center", // Layout, Flexbox & Grid
                "w-6 h-6" // Sizing
              )}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <Circle className="text-gray-400" />
              <Circle
                className={currStatusIndex < index ? "text-gray-400" : ""}
                pathLength={0}
                opacity={0}
                variants={draw}
                custom={{ index, currStatusIndex }}
                fill={
                  editMode || currStatusIndex >= index
                    ? "currentColor"
                    : "transparent"
                }
              />
            </motion.svg>
            {isLast && (
              <motion.svg
                className={cn(
                  "overflow-visible absolute z-0 justify-center items-center", // Layout, Flexbox & Grid
                  "w-full h-6 translate-x-1/2 pointer-events-none", // Sizing, Transforms, Interactivity
                  "pr-[4px] pl-[12px]" // Etc.
                )}
                height={24}
                preserveAspectRatio="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <Line
                  className={cn(
                    "text-gray-400"
                  )}
                />
                <Line
                  stroke={`url(#${stopColorsToGradientId(startColor, endColor)})`}
                  strokeOpacity={1}
                  fillOpacity={1}
                  opacity={0}
                  pathLength={0}
                  variants={draw}
                  custom={{ index, currStatusIndex, isLine: true }}
                />
              </motion.svg>
            )}
          </motion.div>
          <motion.div
            className="flex flex-col items-center justify-center"
            variants={{ hover: { scale: 1.05 } }}
          >
            <p>
              {underScoreToFull(status)
                .split(" ")
                .map((word) => (
                  <span
                    className={cn(
                      "text-sm text-black group-hover:underline break-all", // Typography
                      {
                        "opacity-80 text-gray-400 group-hover:no-underline":
                          index > currStatusIndex,
                      }
                    )}
                    key={word}
                  >
                    {word}
                  </span>
                ))}
            </p>
            {date ? (
              <span className="opcaity-80 text-xs text-gray-400">
                {timeAgo(date)}
              </span>
            ) : null}
          </motion.div>
        </motion.li>
      </TooltipTrigger>
      <BreadcrumbTooltip
        applicationData={applicationData}
        external_id={external_id}
        status={status}
        editMode={editMode}
      />
    </Tooltip>
  );
};

const Circle: FC<ComponentProps<typeof motion.circle>> = (props) => {
  return (
    <motion.circle
      cx="12"
      cy="12"
      r="12"
      stroke="currentColor"
      fill="transparent"
      strokeWidth={3}
      {...props}
    />
  );
};

const Line: FC<ComponentProps<typeof motion.line>> = (props) => {
  return (
    <motion.line
      x1="0"
      y1="12"
      x2="24"
      y2="12"
      stroke="currentColor"
      strokeWidth="4"
      {...props}
    />
  );
};

const stopColorsToGradientId = (startColor?: string, endColor?: string) => {
  if (startColor === "var(--color-green-400)") {
    return "pastOngoing";
  }

  if (endColor === "var(--color-red-400)") {
    return "toReject";
  }

  if (endColor === "var(--color-green-400)") {
    return "toOngoing";
  }

  if (endColor === "var(--color-lime-400)") {
    return "default";
  }

  return null;
};

const underScoreToFull = (str: string) => {
  return str
    .split("_")
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase())
    .join(" ");
};
