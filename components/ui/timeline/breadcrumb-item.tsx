import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import { ApplicationStatus, GroupRecord } from "@/types";
import { Variants, motion } from "framer-motion";
import {
  Ban,
  CheckCircle2Icon,
  CircleEllipsis,
  CircleFadingPlus,
} from "lucide-react";
import { ComponentProps, ComponentPropsWithoutRef, FC } from "react";
import { BreadcrumbTooltip } from "./breadcrumb-tooltip";

export type BreadCrumbItemProps = {
  applicationData: GroupRecord;
  emailData?: CategorizedEmail;
  editMode: boolean;
  isLast?: boolean;
  isLoading: boolean;
  index: number;
  status?: ApplicationStatus;
  stepColor: string;
};

type MotionCustomProps = {
  index: number;
  isLine?: boolean;
};

export const CIRCLE_DURATION = 0.02;
export const LINE_DURATION = 0.01;

const draw = {
  hover: ({ isLine }: MotionCustomProps) => ({
    scale: isLine ? 0.95 : 1.2,
  }),

  hidden: { pathLength: [null, 0], opacity: [null, 0] },
  visible: ({ index, isLine }: MotionCustomProps) => {
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
    emailData,
    applicationData,
    isLast = true,
    isLoading,
    index,
    status,
    stepColor,
  } = props;
  // const setEditingStatus = useApplicationStore(
  //   (store) => store.setEditingStatus
  // );
  const id = emailData?.id;
  const date = emailData?.sent_on;
  const crossOrCheck = status === ApplicationStatus.Rejected;

  const EditIcon = motion.create(id ? CircleEllipsis : CircleFadingPlus);
  const CrumbIcon = motion.create(crossOrCheck ? Ban : CheckCircle2Icon);
  const DisplayIcon = (props: ComponentPropsWithoutRef<typeof EditIcon>) =>
    editMode ? <EditIcon {...props} /> : !id ? <></> : <CrumbIcon {...props} />;
  const onClick = () => {
    // setEditingStatus(status);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.li
          whileHover={"hover"}
          style={{
            color: stepColor,
          }}
          onClick={onClick}
          className={cn(
            "flex flex-1 relative gap-4 items-center group py-2.5",
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
        >
          <motion.div
            className={cn(
              "flex grow-0 justify-center items-center"
            )}
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
                pathLength={0}
                opacity={0}
                variants={draw}
                custom={{ index }}
                fill={editMode || id ? "currentColor" : "transparent"}
              />
            </motion.svg>
            {!isLast && (
              <motion.svg
                className={cn(
                  "overflow-visible absolute top-full z-0", // Layout
                  "justify-center items-center w-full h-6", // Flexbox & Grid, Sizing
                  "translate-x-1/2 pointer-events-none", // Transforms, Interactivity
                  "pr-[0px] pl-[0px]" // Etc.
                )}
                style={{
                  width: "20px",
                  height: "calc(100% - 20px)",
                  top: "calc(50% + 12px)",
                }}
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
                  stroke={`url(#gradient-${applicationData.id}-${index})`}
                  strokeOpacity={1}
                  fillOpacity={1}
                  opacity={0}
                  pathLength={0}
                  variants={draw}
                  custom={{ index, isLine: true }}
                />
              </motion.svg>
            )}
          </motion.div>

          <motion.div className="flex w-24 gap-4">
            <motion.div
              className="flex flex-col justify-center"
              variants={{ hover: { scale: 1.05 } }}
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
          {emailData && (
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
        applicationData={applicationData}
        emailData={emailData}
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
      y1="0"
      x2="0"
      y2="28"
      stroke="currentColor"
      strokeWidth="4"
      {...props}
    />
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
