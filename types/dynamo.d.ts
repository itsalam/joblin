interface CategorizedEmail {
  user_name: string;
  id: string;
  confidence: number;
  company_title: string;
  application_status: ApplicationStatus;
  job_title: string;
  s3_arn: string;
  sent_on: string;
  group_id: string;
  preview?: string;
  subject?: string;
  from?: string;
}

type CategorizeEmailItem = Record<keyof CategorizedEmail, AttributeValue>;

interface CategorizedGroup {
  user_name: string;
  id: string;
  company_title: string;
  job_title: string;
  preview?: string;
  email_ids: Partial<Record<ApplicationStatus, CategorizeEmailItem["id"]>>;
  icon_url?: string;
}

type CategorizedGroupItem = Record<keyof CategorizedGroup, AttributeValue>;
