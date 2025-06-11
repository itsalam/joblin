import { ApplicationStatus } from "@/types";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { ApplicationBadge, BadgeProps } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

export function EditApplicationBadge({
  status,
  edit,
  className,
  ...props
}: BadgeProps & { edit: boolean; status: ApplicationStatus }) {
  const [newStatus, setNewStatus] = useState(status);
  const Chevron = motion.create(ChevronDown);

  return (
    <div
      className={cn(
        "flex gap-2 items-center p-1"
      )}
    >
      <Select
        value={newStatus}
        onValueChange={(value) => setNewStatus(value as ApplicationStatus)}
      >
        <SelectTrigger asChild>
          <ApplicationBadge
            //   {...props}
            status={newStatus}
            className={cn(
              "flex gap-1 items-center",
              edit ? "cursor-pointer" : "pointer-events-none"
            )}
          >
            {edit ? (
              <Chevron
                className="h-3 w-3"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 12, opacity: 1 }}
              />
            ) : null}
          </ApplicationBadge>
        </SelectTrigger>
        <SelectContent className="min-w-min">
          {Object.entries(ApplicationStatus).map(([key, value]) => (
            <SelectItem value={value} key={key}>
              <ApplicationBadge
                status={value}
                className={cn(
                  "flex gap-1 items-center",
                  edit ? "cursor-pointer" : "pointer-events-none"
                )}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
