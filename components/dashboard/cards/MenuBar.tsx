"use client";

import FilterMenu from "@/components/card/CardMenu";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { DateRange, DateRanges } from "@/lib/consts";
import { cn } from "@/lib/utils";
import debounce from "debounce";
import { ChevronDown, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import Header from "@/components/menu/header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Filter, FilterType } from "@/types";
import { Command } from "cmdk";

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
  const { params, setParams, isFetching } = useDashboard();
  const [value, setValue] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const hasBeenUpdated = useRef(false);

  const isFetchingFromMenuBar = isFetching && hasBeenUpdated.current;

  const convertInputToFilter = (
    input: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    for (const filterType in FilterType) {
      const formattedFilterType = filterType.toLocaleLowerCase();
      const regex = new RegExp(
        `${formattedFilterType}:(?:"([^"]+)"|([^\\s"]+))`,
        "gi"
      );

      const match = input.match(regex);
      if (match) {
        e.preventDefault();
        const filterValue = match[0].split(":")[1].trim();
        setFilters((prevFilters) => [
          ...prevFilters,
          {
            category: FilterType[filterType as keyof typeof FilterType],
            value: filterValue.replace(/^"|"$|'/g, ""),
          },
        ]);
        setValue("");
      }
    }
  };

  const onUpdatedValues = (value: string, filters: Filter[]) => {
    setParams((prev) => ({
      ...prev,
      searchTerm: value,
      filters: filters,
    }));
  };

  const updateSearchOptions = useMemo(
    () => debounce(onUpdatedValues, 1200),
    []
  );

  useEffect(() => {
    updateSearchOptions(value, filters);
    hasBeenUpdated.current = true;
  }, [value, filters]);

  useEffect(() => {
    if (!isFetching) {
      hasBeenUpdated.current = false;
    }
  }, [isFetching]);

  return (
    <Header
      className={cn({ "rounded-b-none": value.length || filters.length > 0 })}
    >
      <Command
        label="Search"
        className={cn(
          "w-full h-full dark:to-transparent"
        )}
      >
        <div
          className={cn(
            "flex items-center w-full h-full dark:to-transparent"
          )}
        >
          <div className="relative flex-1 flex items-center px-3 gap-1.5">
            {isFetchingFromMenuBar ? (
              <Spinner size="small" className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Search size={16} className="h-4 w-4 text-muted-foreground" />
            )}
            {filters.map((filter, i) => {
              return (
                <Badge variant="secondary" key={filter.value}>
                  <p className="text-gray-600 pr-0.5">{filter.category}:</p>
                  {filter.value}
                  <X
                    size={12}
                    onClick={() =>
                      setFilters([...filters.filter((_, j) => i !== j)])
                    }
                  />
                </Badge>
              );
            })}
            <Command.Input asChild>
              <Input
                value={value}
                className={cn(
                  "flex flex-1 m-1 h-9 text-base file:text-sm md:text-sm", // Layout, Spacing, Sizing, Typography
                  "file:font-medium",
                  "file:bg-transparent border-0 focus:border-none", // Backgrounds, Borders
                  "focus-visible:outline-hidden",
                  "shadow-none focus:ring-0 focus-visible:ring-0", // Effects
                  "disabled:opacity-50",
                  "transition-colors disabled:cursor-not-allowed", // Transitions & Animation, Interactivity
                  "ml-0 text-md bg-card px-1.5 py-1 file:text-foreground", // Margin, Etc.
                  "placeholder:text-muted-foreground focus-visible:ring-ring"
                )}
                placeholder="Search"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // setFilters((prevFilters) => [
                    //   ...prevFilters,
                    //   { category: "Subject", value: e.target.value },
                    // ]);
                    // setFields({ name: e.target.value });
                  } else if (e.key === "Backspace") {
                    const cursorPosition = (e.target as HTMLInputElement)
                      .selectionStart;
                    if (!cursorPosition) {
                      setFilters((prevFilters) => [
                        ...prevFilters.slice(0, prevFilters.length - 1),
                      ]);
                    }
                  } else if (e.key === " ") {
                    convertInputToFilter(
                      (e.target as HTMLInputElement).value,
                      e
                    );
                  }
                }}
                onChange={(e) => {
                  setValue(e.target.value);
                }}
                //   onChange={(e) => setFields({ name: e.target.value })}
              />
            </Command.Input>
          </div>

          <Separator orientation="vertical" className="my-3" />

          <DateMenu
            absolute={!!params.absolute}
            dateKey={params.dateKey ?? DateRanges.Monthly}
            setDateKey={(dateKey) =>
              setParams((options) => ({ ...options, dateKey }))
            }
            setAbsolute={() =>
              setParams((options) => ({
                ...options,
                absolute: !options.absolute,
              }))
            }
          />

          <Separator orientation="vertical" className="my-3" />
          <FilterMenu />
        </div>
        {value.length !== 0 && (
          <Card
            className="border-zinc-200 border-t-0 dark:border-zinc-800 flex rounded-t-none shadow-none"
            style={{ width: "calc(100% + 2px)", left: "-1px" }}
          >
            <Command.List className="flex-2/3 px-3 py-1">
              <Command.Empty>No results found.</Command.Empty>

              <Command.Group
                heading={<p className="text-xs text-gray-400 pl-1">Results</p>}
              >
                {/* <Command.Item>a</Command.Item>
              <Command.Item>b</Command.Item>
              <Command.Separator />
              <Command.Item>c</Command.Item> */}
              </Command.Group>

              {/* <Command.Item>Apple</Command.Item> */}
            </Command.List>
            <div></div>
          </Card>
        )}
      </Command>
    </Header>
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
            "flex justify-center items-center p-3", // Layout, Flexbox & Grid, Spacing
            "w-40 h-full text-sm text-zinc-500 dark:text-white", // Sizing, Typography
            "hover:bg-gray-100 dark:bg-zinc-950 dark:hover:bg-white/20", // Backgrounds
            "dark:active:bg-white/10",
            "rounded-none shadow-none transition duration-200", // Borders, Effects, Transitions & Animation
            "hover:cursor-pointer bg-lightPrimary px-3" // Interactivity, Etc.
          )}
        >
          {labels[dateKey]}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-80 w-40 border-zinc-200 dark:border-zinc-800">
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
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className={"text-sm"}
        >
          <Checkbox checked={absolute} onCheckedChange={setAbsolute}></Checkbox>
          <p>Absolute</p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
