"use client";

import { useDashboard } from "@/app/(providers)/DashboardProvider";
import FilterMenu from "@/components/card/CardMenu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DateRange, DateRanges } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import React from "react";

const absDateKeyLabels: Record<DateRange, string> = {
  [DateRanges.Weekly]: "Last 7 Days",
  [DateRanges.Bi_Weekly]: "Last 14 Days",
  [DateRanges.Monthly]: "Last 30 Days",
  [DateRanges.Quarterly]: "Last 3 Months",
  [DateRanges.Yearly]: "Last 12 Months",
};

const relDateKeyLabels: Record<DateRange, string> = {
  [DateRanges.Weekly]: "This week",
  [DateRanges.Bi_Weekly]: "This sprint",
  [DateRanges.Monthly]: "This Month",
  [DateRanges.Quarterly]: "This quarter",
  [DateRanges.Yearly]: "This year",
};

export default function MenuBar() {
  const { options, setOptions } = useDashboard();

  return (
    <div className="border-zinc-200 dark:border-zinc-800 w-full overflow-hidden h-full flex items-center top-0 right-0 bg-gradient-to-b from-white via-white to-transparent dark:from-zinc-900 dark:to-transparent">
      <div className="relative pb-0 flex flex-1 h-full">
        <Search
          size={24}
          className="absolute left-2 top-[0.875rem] h-4 w-4 text-muted-foreground"
        />
        <Input
          className="text-md bg-card m-1 ml-0 flex h-9 flex-1 px-3 py-1 text-base shadow-none transition-colors border-0 focus:border-none file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 focus:ring-0 md:text-sm pl-7 focus-visible:ring-0"
          placeholder="Search"
          //   onChange={(e) => setFields({ name: e.target.value })}
        />
      </div>
      <Separator orientation="vertical" className="my-3"/>

      <DateMenu
        absolute={options.absolute}
        dateKey={options.dateKey}
        setDateKey={(dateKey) =>
          setOptions((options) => ({ ...options, dateKey }))
        }
        setAbsolute={() =>
          setOptions((options) => ({
            ...options,
            absolute: !options.absolute,
          }))
        }
      />

<Separator orientation="vertical" className="my-3"/>
      <FilterMenu />
    </div>
  );
}

function DateMenu({
  absolute,
  dateKey,
  setAbsolute,
  setDateKey,
}: {
  absolute: boolean;
  dateKey: DateRange;
  setDateKey?: (dateKey: DateRange) => void;
  setAbsolute?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const labels = absolute ? absDateKeyLabels : relDateKeyLabels;
  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            onClick={() => setOpen(!open)}
            className={cn(
              'flex h-full', // Layout
              'justify-center items-center p-3 w-40', // Flexbox & Grid, Spacing, Sizing
              'text-sm text-zinc-500 dark:text-white', // Typography
              'hover:bg-gray-100 dark:bg-zinc-950 dark:hover:bg-white/20', // Backgrounds
              'dark:active:bg-white/10',
              'rounded-none transition duration-200', // Borders, Transitions & Animation
              'hover:cursor-pointer bg-lightPrimary px-3' // Interactivity, Etc.
            )}
          >
            {labels[dateKey]}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-[80] w-40 border-zinc-200 dark:border-zinc-800">
          <DropdownMenuRadioGroup
            value={dateKey}
            onValueChange={(key) => setDateKey?.(key as DateRange)}
          >
            {Object.values(DateRanges).map((dateKey) => (
              <DropdownMenuRadioItem value={dateKey} key={dateKey}>
                <p className="flex cursor-pointer items-center gap-2 text-zinc-800 hover:font-medium hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                  {labels[dateKey as DateRange]}
                </p>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={"text-sm"}>

          <Checkbox
        checked={absolute}
        onCheckedChange={setAbsolute
        }
      >

      </Checkbox>
      <p>Absolute</p> 
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
