import { DateRange } from "@/lib/consts";
import { ParsedMail } from "mailparser";

export type OpenAIResult = {
  is_job_application: boolean;
  applications: {
    company_title: string;
    job_title: string;
    confidence: number;
    application_status: ApplicationStatus;
  }[];
};

export type ParsedEmailContent = {
  id?: string;
  text?: ParsedMail["text"];
  subject?: ParsedMail["subject"];
  date: ParsedMail["date"];
  from?: string;
  priority?: string;
  html: ParsedMail["html"];
  preview?: string;
};

export enum ApplicationStatus {
  "ApplicationAcknowledged" = "ACK'D",
  "InterviewRequested" = "INTERVIEW",
  "Complete" = "COMPLETE",
  "OfferExtended" = "OFFER",
  "Rejected" = "REJECTED",
  "Proceed" = "PROCEED",
}

export type OpenSearchRecord = CategorizedEmail & {
  text?: string;
};

export type Group<K extends ApplicationStatus, V = CategorizedEmail[]> = {
  [key in K]?: V;
};

export type GroupDetails = {
  id: string;
  user_name: string;
  company_title: string;
  job_title: string;
  last_updated?: string;
  last_email_subject?: string;
  last_status?: ApplicationStatus;
  created_at?: string;
};

export type GroupRecord = GroupDetails & {
  email_ids: Group<ApplicationStatus, CategorizedEmail["id"][]>;
  last_email_subject?: string;
};

export type FullGroupRecord = GroupDetails & {
  email_ids: Group<ApplicationStatus>;
};

export type UserRecord = {
  user_name: string;
  app_email: string;
  source_emails: Set<string>;
  user_email: string;
};

export enum FilterType {
  Subject = "Subject",
  Company = "Company",
  Position = "Position",
  Id = "Id",
  Group = "GroupId",
}

export type Filter = {
  category: FilterType;
  value: string;
};

export const Statistics = {
  TOTAL_APPLICATIONS: "Total Applications Sent",
  TOTAL_RESPOSNES: "Total Responses",
  TOTAL_INTERVIEWS: "Total Interviews",
  REJECT_RATE: "Rejection Rate",
  AVERAGE_RESPONSE_TIME: "Average Response Time",
  RESPONSE_BY_CATEGORY: "Responses by Category",
};

export type StatisticKey = keyof typeof Statistics;
type StatisticValue = (typeof Statistics)[StatisticKey];

export type DashboardParams = {
  dateKey?: DateRange;
  absolute?: boolean;
  searchTerm?: string;
  filters?: Filter[];
  displayedStatistics?: StatisticKey[];
  emailPageIndex?: number;
  emailSortKey?: keyof CategorizedEmail;
  applicationPageIndex?: number;
  applicationSortKey?: keyof GroupRecord;
};
