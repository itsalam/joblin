import { ApplicationStatusColor } from "@/components/helpers";
import { ApplicationStatus, Group } from "@/types";
import { Variants } from "framer-motion";

export type FetchData = { emails: CategorizedEmail[] };

export type BreadCrumbData = {
  displayData?: CategorizedEmailDisplayData;
  id?: string;
  application_status?: ApplicationStatus;
  sent_on?: string;
};

export type CategorizedEmailDisplayData = Pick<CategorizedEmail, "id"> &
  Partial<Omit<CategorizedEmail, "id">>;

export type BreadCrumbItemProps = {
  emailData?: CategorizedEmailDisplayData;
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
export const LINE_STROKE_WIDTH = 4;
export const CIRCLE_RADIUS = 12;
export const MIN_SPACING = 20;
export const CIRCLE_STROKE_WIDTH = 3;
export const LOADING_SPIN_DURATION = 1;
export const LOADING_LINE_DURATION = 0.3;

export const BASE_URL = "/api/application/emails";

export const groupToArr = <T extends any>(
  group: Group<ApplicationStatus, T[]>
) => {
  return Object.entries(group).reduce(
    (acc, [key, value]) => {
      if (value.length > 0) {
        acc = acc.concat(
          value.map((subVal) => ({
            status: key as ApplicationStatus,
            value: subVal,
          }))
        );
      }
      return acc;
    },
    [] as { status: ApplicationStatus; value: T }[]
  );
};

export const getStepColor = (id?: string, status?: ApplicationStatus) => {
  return id && status
    ? (ApplicationStatusColor[status] ?? "var(--color-gray-300)")
    : "var(--color-gray-300)";
};

export const draw = {
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
