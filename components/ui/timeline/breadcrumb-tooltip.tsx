import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { FC } from "react";
import { BreadCrumbItemProps } from "./breadcrumb-item";

type BreadCrumbTooltipProps = Pick<
  BreadCrumbItemProps,
  "external_id" | "status" | "applicationData" | "editMode"
>;

export const CIRCLE_DURATION = 0.02;
export const LINE_DURATION = 0.01;

export const BreadcrumbTooltip: FC<BreadCrumbTooltipProps> = (props) => {
  const { applicationData, editMode, external_id, status } = props;
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
          : external_id
            ? "Edit this status"
            : "Update status"}
      </>
    );
  };

  return (
    <TooltipContent sideOffset={10} className={cn()}>
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
          Expand
        </p>
      )}
    </TooltipContent>
  );
};
