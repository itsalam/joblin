export type DateRange =
  | "Weekly"
  | "Bi_Weekly"
  | "Monthly"
  | "Quarterly"
  | "Yearly";

export const DateRanges = {
  Weekly: "Weekly",
  Bi_Weekly: "Bi_Weekly",
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  Yearly: "Yearly",
} as const;

export const MAX_APPLICATION_PAGE_SIZE = 10;
