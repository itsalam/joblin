import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import { ApplicationStatus } from "@/types";
import { motion } from "framer-motion";
import {
  Ban,
  CheckCircle2Icon,
  CircleEllipsis,
  CircleFadingPlus,
} from "lucide-react";
import {
  ComponentProps,
  ComponentPropsWithoutRef,
  FC,
  useCallback,
} from "react";
import { BreadcrumbTooltip } from "./breadcrumb-tooltip";
import {
  BreadCrumbItemProps,
  CIRCLE_DURATION,
  CIRCLE_RADIUS,
  CIRCLE_STROKE_WIDTH,
  draw,
  LINE_STROKE_WIDTH,
  LOADING_LINE_DURATION,
  LOADING_SPIN_DURATION,
  MIN_SPACING,
} from "./helpers";
import { Circle, Line } from "./shapes";

export const BreadCrumbItem: FC<
  BreadCrumbItemProps & ComponentProps<typeof motion.li>
> = (props) => {
  const {
    editMode,
    emailData,
    isLast = true,
    isLoading,
    index,
    status,
    stepColor,
    ...componentProps
  } = props;

  const id = emailData?.id;
  const date = emailData?.sent_on;
  const crossOrCheck = status === ApplicationStatus.Rejected;

  const EditIcon = motion.create(id ? CircleEllipsis : CircleFadingPlus);
  const CrumbIcon = motion.create(crossOrCheck ? Ban : CheckCircle2Icon);
  const DisplayIcon = (props: ComponentPropsWithoutRef<typeof EditIcon>) =>
    editMode ? <EditIcon {...props} /> : !id ? <></> : <CrumbIcon {...props} />;

  const BreadcrumbSVG = useCallback(() => {
    return (
      <motion.div
        className={cn(
          "flex grow-0 justify-center items-center"
        )}
        style={{
          paddingTop: `${CIRCLE_RADIUS / 2}px`,
        }}
      >
        <DisplayIcon
          className="absolute z-20 text-white"
          size={18}
          variants={{ hover: { scale: 1.1 }, initial: { scale: 1.0 } }}
        />
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
            initial={false}
            variants={draw}
            custom={{ index }}
            fill={id ? "currentColor" : "transparent"}
          />
          {isLoading && (
            <Circle
              className="text-gray-200"
              strokeDasharray={2 * Math.PI * CIRCLE_RADIUS}
              strokeDashoffset={(Math.PI * CIRCLE_RADIUS) / 4}
              animate={{ rotate: 360 }}
              transition={{
                repeat: Infinity,
                duration: LOADING_SPIN_DURATION,
                ease: "linear",
                delay:
                  index * (LOADING_SPIN_DURATION / 2 + LOADING_LINE_DURATION),
              }}
            />
          )}
        </motion.svg>
        {!isLast && (
          <motion.svg
            className={cn(
              "overflow-visible absolute top-full z-0 justify-center", // Layout, Flexbox & Grid
              "items-center",
              "w-full h-6 translate-x-1/2 pointer-events-none", // Sizing, Transforms, Interactivity
              "pr-[0px] pl-[0px]" // Etc.
            )}
            style={{
              width: `${CIRCLE_RADIUS * 2 - LINE_STROKE_WIDTH}px`,
              height: `calc(100% - ${CIRCLE_RADIUS * 2 + CIRCLE_STROKE_WIDTH}px)`,
              top: `${CIRCLE_RADIUS * 2.5 + CIRCLE_STROKE_WIDTH / 2}px`,
            }}
            preserveAspectRatio="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <Line
              className={cn(
                "text-gray-200"
              )}
            />
            <Line
              stroke={
                id
                  ? `url(#gradient-${emailData?.group_id}-${index})`
                  : "transparent"
              }
              strokeOpacity={1}
              fillOpacity={1}
              opacity={0}
              pathLength={0}
              initial={false}
              variants={draw}
              custom={{ index, isLine: true }}
            />
            {isLoading && (
              <Line
                className="text-gray-300"
                pathLength={1} // Normalize to [0, 1] range
                strokeDashoffset={0}
                animate={{
                  pathLength: [1, 0],
                  strokeDashoffset: [0.0, 1.0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: LOADING_LINE_DURATION,
                  ease: "linear",
                  repeatDelay: LOADING_SPIN_DURATION,
                  delay:
                    LOADING_SPIN_DURATION / 2 +
                    index * (LOADING_SPIN_DURATION + LOADING_LINE_DURATION),
                }}
              />
            )}
          </motion.svg>
        )}
      </motion.div>
    );
  }, [id, isLoading]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.li
          key={id || `new-${index}`}
          whileHover={"hover"}
          style={{
            color: stepColor,
          }}
          className={cn(
            "flex flex-1 relative gap-4 items-start group",
            {
              "cursor-default": !editMode,
              "cursor-pointer": editMode || id,
              "animate-pulse": isLoading,
              "pointer-events-none": !id && !editMode,
            }
          )}
          transition={{
            staggerChildren: CIRCLE_DURATION,
          }}
          {...componentProps}
        >
          <BreadcrumbSVG />

          <motion.div className="flex w-24 gap-4">
            <motion.div
              className="flex flex-col justify-start"
              variants={{ hover: { scale: 1.05 } }}
              style={{
                minHeight: `${CIRCLE_RADIUS * 2 + (isLast ? 0 : MIN_SPACING)}px`,
              }}
            >
              <p
                className={cn(
                  "text-sm text-black break-all",
                  {
                    "opacity-80 text-gray-500 ": !id,
                    "group-hover:opacity-100 group-hover:text-black": editMode,
                  }
                )}
              >
                {!status ? "New Email" : underScoreToFull(status)}
              </p>
              {date ? (
                <span className="opcaity-80 text-xs text-gray-400">
                  {new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "2-digit",
                  })}
                </span>
              ) : null}
            </motion.div>
            {(editMode || emailData) && (
              <motion.div
                className="h-0.5 flex-1 my-auto bg-gray-200"
                {...(editMode && !emailData
                  ? { variants: { hover: { flex: 1 } }, initial: { flex: 0 } }
                  : {})}
              />
            )}
          </motion.div>
          {emailData?.subject && (
            <div>
              <p className="text-sm text-black line-clamp-1 w-sm">
                {emailData?.subject}
              </p>
              <p className="text-xs text-gray-400 line-clamp-1 w-md">
                {emailData?.preview}
              </p>
            </div>
          )}
        </motion.li>
      </TooltipTrigger>
      <BreadcrumbTooltip
        emailData={emailData}
        status={status}
        editMode={editMode}
      />
    </Tooltip>
  );
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
