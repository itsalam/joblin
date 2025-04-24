"use client";

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
import { cn, timeAgo } from "@/lib/utils";
import { ParsedEmailContent } from "@/types";
import DOMPurify from "dompurify";
import { Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { HTMLProps, useCallback, useEffect, useRef, useState } from "react";
import { LogoAvatar } from "../LogoAvatar";

type RowObj = {
  checked?: string;
  email: string;
  provider: string;
  created: string;
  lastsigned: string;
  uuid: string;
  menu?: string;
};

function Emails(props: { emails: CategorizedEmail[]; isFetching: boolean }) {
  const { emails, isFetching } = props;
  const [activeEmail, setActiveEmail] = useState<CategorizedEmail>(emails?.[0]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const hasFetched = useRef(false);

  useEffect(() => {
    hasFetched.current = hasFetched.current || isFetching;
    if (isFetching) {
      setPage(0);
    }
  }, [isFetching]);

  const EmailCard = useCallback(({
    email,
    ...props
  }: { email: CategorizedEmail } & HTMLProps<HTMLDivElement>) => {
    const sanitizedHTML = email.preview
      ? DOMPurify.sanitize(email.preview)
      : "";
    // Sanitize the HTML

    // Parse into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHTML, "text/html");

    // Extract plain text
    const text = doc.body.textContent ?? "";
    return (
      <Card
        className={
          "h-full w-full border-zinc-200 p-0 dark:border-zinc-800 sm:overflow-auto hover:bg-gray-100 transition duration-200"
        }
        {...props}
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex gap-3 items-center">
            <LogoAvatar company={email.company_title} size={32} />
            <div className="flex flex-col w-full">
              <div></div>
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
              {text}
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
    <Card className={"h-full w-full border-zinc-200 p-0 dark:border-zinc-800"}>
      <ResizablePanelGroup
        direction="horizontal"
        className="flex overflow-hidden max-h-[600px]"
      >
        <ResizablePanel defaultSize={40} className="flex flex-col relative">
          <div className="flex items-center justify-between">
            {(isFetching || !hasFetched.current) && (
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
            className={cn(
              "flex-1 p-3 transition-opacity overflow-y-scroll",
              { "opacity-25 pointer-none:": isFetching || !hasFetched.current }
            )}
          >
            <div className="flex flex-col gap-3">
              {emails.slice(page * pageSize, (page + 1) * pageSize).map((
                email
              ) => {
                return (
                  <EmailCard
                    email={email}
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
          <div className="flex items-center gap-1">
            <Button variant="ghost">
              <Archive />
            </Button>
            <Button variant="ghost">
              <Archive />
            </Button>
            <Button variant="ghost">
              <Archive />
            </Button>
          </div>
          <Separator orientation="horizontal" />
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
  const [emailContent, setEmailContent] = useState<ParsedEmailContent | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const baseURL = "/api/email-data";

  useEffect(() => {
    const fetchEmailContent = async () => {
      if (loadedEmail.current?.id === email.id) return; // already loaded
      setLoading(true);
      const searchParams = new URLSearchParams({
        s3_arn: email.s3_arn,
      });

      const url = `${baseURL}?${searchParams.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      loadedEmail.current = data;
      console.log(data);
      if (data.error) {
        setError(data.error);
      } else if (data.email) {
        const html = DOMPurify.sanitize(data.email.html, {
          USE_PROFILES: { html: true }, // optionally allow styling/images
        });

        setEmailContent({ ...(data.email as ParsedEmailContent), html });
      }
      setLoading(false);
    };
    fetchEmailContent();
  }, [email.id]);

  return (
    <div className="flex flex-col h-full flex-1 overflow-hidden">
      <div className="flex gap-3 items-center p-5">
        <LogoAvatar company={email.company_title} size={44} />
        <div className="flex flex-col gap-0.5 w-full">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              {email.company_title}

              <span className="font-normal text-xs text-zinc-600 dark:text-white">
                {` <${email.from}>`}
              </span>
            </p>
            <p className="text-xs font-medium text-zinc-950 dark:text-white">
              {timeAgo(email.sent_on)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-950 dark:text-white">
              {email.subject}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-600 dark:text-white">
              {`${email.job_title}`}
            </p>
          </div>
        </div>
      </div>

      <Separator orientation="horizontal" />
      <div className="flex flex-col items-start gap-3 p-1 flex-1 overflow-y-scroll">
        {emailContent?.html ? (
          <div
            className="email-content flex flex-col gap-0.5 text-xs text-zinc-600 dark:text-white"
            dangerouslySetInnerHTML={{ __html: emailContent.html }}
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
  );
};

export default Emails;
