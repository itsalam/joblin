"use client";

import { createSafeId, safelyParseHTMLForDisplay } from "@/components/helpers";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { ApplicationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, timeAgo } from "@/lib/utils";
import { GroupRecord, ParsedEmailContent } from "@/types";
import { ChevronLeft, ChevronRight, PencilIcon } from "lucide-react";
import {
  ComponentProps,
  HTMLProps,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EditApplicationBadge } from "../EditApplicationBadge";
import { EditPopoverInput } from "../EditPopoverInput";
import { LogoAvatar } from "../LogoAvatar";

function Emails(props: { emails: CategorizedEmail[] }) {
  const { setActiveEmail, activeEmail, isFetching } = useDashboard();
  const { emails } = props;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const emailContainerRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    hasFetched.current = hasFetched.current || isFetching["emails"];
    if (isFetching["emails"]) {
      setPage(0);
    }
  }, [isFetching]);

  const EmailListing = useCallback(({
    email,
    active,
    ...props
  }: {
    email: CategorizedEmail;
    active: boolean;
  } & HTMLProps<HTMLDivElement>) => {
    return (
      <Card
        className={cn(
          "sm:overflow-auto p-0 w-full h-full hover:bg-gray-100", // Layout, Spacing, Sizing, Backgrounds
          "border-zinc-200 dark:border-zinc-800 transition duration-200", // Borders, Transitions & Animation
          active ? "bg-gray-100 dark:bg-zinc-800" : ""
        )}
        {...props}
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex gap-3 items-center">
            <LogoAvatar company={email.company_title} size={32} />
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {email.company_title}
                </p>
                <p className="text-xs font-medium text-zinc-950 dark:text-white">
                  {timeAgo(email.sent_on)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-950 dark:text-white line-clamp-1 ellipsis">
                  {email.subject}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3">
            <p className="text-xs text-zinc-600 dark:text-white line-clamp-2 ellipsis">
              {email.preview}
            </p>
            <div className="flex gap-1">
              {email.application_status && (
                <ApplicationBadge status={email.application_status} />
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }, []);

  return (
    <Card
      className={"w-full border-zinc-200 p-0 dark:border-zinc-800 h-[540px]"}
      id="email-card"
    >
      <ResizablePanelGroup
        direction="horizontal"
        className="flex overflow-hidden max-h-[540px]"
      >
        <ResizablePanel defaultSize={40} className="flex flex-col relative">
          <div className="flex items-center justify-between">
            {(isFetching["emails"] || !hasFetched.current) && (
              <Spinner className="ml-3" />
            )}
            <div className="flex items-center justify-end ml-auto">
              <p className="text-sm text-gray-500">
                {1 + page * pageSize}-
                {Math.min((page + 1) * pageSize, emails.length)} of{" "}
                {emails.length}
              </p>
              <Button
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                disabled={page === Math.ceil(emails.length / pageSize) - 1}
                onClick={() =>
                  setPage(
                    Math.min(page + 1, Math.ceil(emails.length / pageSize) - 1)
                  )
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <Separator orientation="horizontal" />
          <div
            role="group"
            className={cn(
              "flex-1 p-3 transition-opacity overflow-y-scroll",
              {
                "opacity-25 pointer-none:":
                  isFetching["emails"] || !hasFetched.current,
              }
            )}
          >
            <div className="flex flex-col gap-3" ref={emailContainerRef}>
              {emails.slice(page * pageSize, (page + 1) * pageSize).map((
                email
              ) => {
                return (
                  <EmailListing
                    active={activeEmail?.id === email.id}
                    email={email}
                    id={createSafeId(email.id)}
                    key={email.id}
                    onClick={() => setActiveEmail(email)}
                  />
                );
              })}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="flex flex-col relative">
          {activeEmail && <EmailDetailPanel email={activeEmail} />}
          <Separator orientation="horizontal" />
          <div className="mt-2 flex h-12 w-full items-center justify-between px-5">
            {/* left side */}
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Showing 6 rows per page
              </p>
            </div>
            {/* right side */}
            <div className="flex items-center gap-2">
              <Button
                className={`flex items-center justify-center rounded-lg bg-transparent p-3 text-lg text-zinc-950 transition duration-200 hover:bg-transparent active:bg-transparent dark:text-white dark:hover:bg-transparent dark:active:bg-transparent`}
              >
                <ChevronLeft />
              </Button>
              <Button
                className={`flex min-w-[34px] items-center justify-center rounded-lg bg-transparent p-3 text-lg text-zinc-950 transition duration-200 hover:bg-transparent active:bg-transparent dark:text-white dark:hover:bg-transparent dark:active:bg-transparent`}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Card>
  );
}

const EmailDetailPanel = ({ email }: { email: CategorizedEmail }) => {
  const loadedEmail = useRef<ParsedEmailContent>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [emailContent, setEmailContent] = useState<ParsedEmailContent | null>(
    null
  );

  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const baseURL = "/api/email-data";

  console.log("EmailDetailPanel", email);

  useEffect(() => {
    const fetchEmailContent = async () => {
      if (loadedEmail.current?.id === email.id) return; // already loaded
      setLoading(true);
      const searchParams = new URLSearchParams({
        messageId: email.id,
        s3_arn: email.s3_arn,
      });

      const url = `${baseURL}?${searchParams.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      loadedEmail.current = data;
      if (data.error) {
        setError(data.error);
      } else if (data.email && data.html) {
        const html = safelyParseHTMLForDisplay(data.html);
        setEmailContent({ ...(data.email as ParsedEmailContent), html });
      }
      setLoading(false);
    };
    fetchEmailContent();
  }, [email.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Clear existing content
    doc.body.innerHTML = "";
    doc.head.innerHTML = "";

    // Optional: set <base> tag to make links open in new tabs
    const base = doc.createElement("base");
    base.target = "_blank";
    doc.head.appendChild(base);

    // Set encoding
    const metaCharset = doc.createElement("meta");
    metaCharset.setAttribute("charset", "utf-8");
    doc.head.appendChild(metaCharset);

    // Insert sanitized HTML
    const wrapper = doc.createElement("div");
    if (emailContent?.html) {
      wrapper.innerHTML = emailContent?.html;
    }
    doc.body.appendChild(wrapper);
  }, [emailContent]);

  const Avatar = useCallback(
    () => (
      <LogoAvatar company={email.company_title} size={44} isLoading={loading} />
    ),
    [email]
  );

  type GroupRecordSubdata = Pick<
    GroupRecord,
    "company_title" | "job_title" | "id"
  >;

  const groupRecordData = {
    company_title: email.company_title,
    job_title: email.job_title,
    id: email.group_id,
  };

  const suggestApplications = useCallback(
    async (searchTerm?: string) => {
      if (!email.company_title) return [];
      const searchParams = new URLSearchParams({
        application_title: email.job_title,
        company_title: email.company_title,
      });
      if (searchTerm) {
        searchParams.set("search_term", searchTerm);
      }
      const url = `/api/applications/suggest?${searchParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        // TODO: Make a toast for this?
        return [];
      }
      const data = await response.json();
      const applications: GroupRecordSubdata[] = data.applications || [];

      return applications;
    },
    [email.company_title, email.job_title]
  );

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <TooltipButton
            variant="ghost"
            content="Edit"
            onClick={() => setEdit((edit) => !edit)}
          >
            <PencilIcon />
          </TooltipButton>
        </div>
      </TooltipProvider>
      <Separator orientation="horizontal" />
      <div
        className="flex flex-col h-full flex-1 overflow-hidden"
        id={email.id}
      >
        <div className="flex gap-3 items-center p-5">
          <Avatar />

          <div className="flex items-center gap-2 h-full relative justify-between w-full">
            <div className="flex flex-col gap-0.5 w-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {email.company_title}
                  <span className="font-normal text-xs text-zinc-600 dark:text-white">
                    {` <${email.from}>`}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-950 dark:text-white">
                  {email.subject}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EditPopoverInput<GroupRecordSubdata>
                  initialValue={groupRecordData}
                  edit={edit}
                  key={groupRecordData.id}
                  placeholder="Untitled Application"
                  className="text-xs text-zinc-600 dark:text-white"
                  fetchItems={suggestApplications}
                  extractSearchValue={(value) => value.job_title || ""}
                  renderItem={(value) => {
                    const { id, company_title, job_title } = value;
                    return {
                      value: value,
                      children: (
                        <div className="flex gap-2 items-center py-1">
                          <LogoAvatar company={company_title} size={40} />
                          <div className="flex flex-col w-full">
                            <div className="flex flex-col items-start font-semibold justify-between">
                              <p className="text-xs text-zinc-950 dark:text-white">
                                {company_title}
                              </p>
                              <p
                                className={cn(
                                  "text-xs font-medium text-zinc-950", // Typography
                                  "dark:text-white",
                                  !!!job_title.length && "text-zinc-400"
                                )}
                              >
                                {job_title.length ? job_title : "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ),
                    };
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end justify-around w-min h-full">
              <p className="text-xs font-medium text-zinc-950 dark:text-white text-nowrap">
                {timeAgo(email.sent_on)}
              </p>
              <EditApplicationBadge
                status={email.application_status}
                className="text-xs"
                edit={edit}
              />
            </div>
          </div>
        </div>

        <Separator orientation="horizontal" />
        <div className="flex flex-col items-start gap-3 p-1 flex-1 overflow-y-scroll">
          {emailContent?.html ? (
            <iframe
              ref={iframeRef}
              title="Email Preview"
              sandbox="allow-same-origin"
              className="email-content flex flex-col justify-center align-middle w-full h-full gap-0.5 text-xs text-zinc-600 dark:text-white [&>p]:px-5 [&>p]:p-1 [&>p]:first:pt-5 [&>p]:last:pb-5"
              style={{}}
            />
          ) : (
            <div className="email-content flex flex-col gap-0.5 p-5 text-xs text-zinc-600 dark:text-white w-full">
              {emailContent?.text}
            </div>
          )}
          <div className="flex gap-1">
            {/* <Badge variant="outline">{email.application_status.toLocaleUpperCase().slice(0, 1).concat(email.application_status.slice(1).toLocaleLowerCase())}</Badge> */}
          </div>
        </div>
      </div>
    </>
  );
};

const TooltipButton = ({
  content,
  ...props
}: ComponentProps<typeof Button> & { content: ReactNode }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center justify-center rounded-lg bg-transparent p-3 text-lg text-zinc-950 transition duration-200 hover:bg-transparent active:bg-transparent dark:text-white dark:hover:bg-transparent dark:active:bg-transparent"
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="w-fit rounded-lg bg-white text-zinc-950 dark:bg-zinc-800 dark:text-white border-1"
        sideOffset={5}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

export default Emails;
