import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { FC } from "react";
import { BreadCrumbItemProps } from "./helpers";

type BreadCrumbTooltipProps = Pick<
  BreadCrumbItemProps,
  "emailData" | "status" | "editMode"
>;

export const CIRCLE_DURATION = 0.02;
export const LINE_DURATION = 0.01;

export const BreadcrumbTooltip: FC<BreadCrumbTooltipProps> = (props) => {
  const { editMode, emailData, status } = props;
  const postingUrl = null;

  const OpenLink = (props: { title: string; url?: string }) => (
    <a
      href={props.url}
      target="_blank"
      className={cn(
        "flex items-center text-sm hover:underline"
      )}
    >
      {props.title}
      <ArrowUpRight />
    </a>
  );

  const EditTooltip = () => {
    return (
      <>
        {false
          ? "Update URL"
          : emailData
            ? "Edit this email"
            : "Add a new email"}
      </>
    );
  };

  return (
    <TooltipContent side="left" sideOffset={10} className={cn()}>
      {editMode ? (
        <EditTooltip />
      ) : false ? (
        postingUrl ? (
          <OpenLink
            title="Open job posting link"
            url={postingUrl ?? undefined}
          />
        ) : (
          <p className="w-52 text-gray-400">
            Job posting URL is missing, but related application emails are
            found.
          </p>
        )
      ) : (
        <p
          className={cn(
            "flex items-center text-sm hover:underline"
          )}
        >
          View in Email Client
        </p>
      )}
    </TooltipContent>
  );
};
