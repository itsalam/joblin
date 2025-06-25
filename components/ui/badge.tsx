import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";
import { ApplicationStatus } from "@/types";
import { ApplicationStatusStyle } from "../helpers";
import { Skeleton } from "./skeleton";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function ApplicationBadge({
  status,
  className,
  children,
  isLoading,
  ...props
}: BadgeProps & { status?: ApplicationStatus; isLoading?: boolean }) {
  return (
    <Badge
      variant="outline"
      {...props}
      className={cn(
        isLoading
          ? "p-0 border-none"
          : status
            ? ApplicationStatusStyle[status]
            : "text-gray-300 border-gray-300 bg-gray-100 opacity-80",
        className
      )}
    >
      {isLoading ? (
        <Skeleton className="w-14 h-6" />
      ) : status ? (
        status
          .toLocaleUpperCase()
          .slice(0, 1)
          .concat(status.slice(1).toLocaleLowerCase())
      ) : (
        "Archived"
      )}
      {children}
    </Badge>
  );
}

export { Badge, badgeVariants };
