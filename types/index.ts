import { ParsedMail } from "mailparser";

export type OpenAIResult = {
  is_job_application: boolean;
  company_title: string;
  job_title: string;
  confidence: number;
  application_status: ApplicationStatus;
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

export type OpenSearchRecord = {
  company_title: string;
  job_title: string;
  group_id: string;
  text?: string;
  subject?: string;
  date?: Date;
  from?: string;
  status: ApplicationStatus;
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
  source_emails: string[];
  user_email: string;
};
