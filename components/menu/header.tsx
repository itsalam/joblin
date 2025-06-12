"use client";

import { cn } from "@/lib/utils";
import { HTMLProps, ReactNode, useEffect, useState } from "react";
import { Card } from "../ui/card";

export const HeaderSection = ({
  children,
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        "border-slate-300 mb-3 border-b pb-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const Header = ({
  children,
  className,
  showBacking = true,
}: {
  children?: ReactNode;
  className?: string;
  showBacking?: boolean;
}) => {
  const [sticking, setSticking] = useState(false);
  useEffect(() => {
    const sentinel = document.querySelector("#header-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setSticking(entry.boundingClientRect.y < 0);
      },
      { root: document.querySelector(".scroll-container"), threshold: [0] }
    );

    observer.observe(sentinel);
    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  });
  return (
    <>
      <div id="header-sentinel" className="h-0" key={"sentinal"} />
      <div className="p-1.5 px-3 sticky top-0 z-10" key="header">
        <HeaderSection
          className={cn(
            "top-0 left-0 z-50 w-full opacity-0", // Layout, Sizing, Effects
            "mb-0 pb-1.5 animate-fade-in border-b [--animation-delay:600ms]", // Margin, Etc.
            sticking ? "border-transparent" : ""
          )}
        >
          <Card
            className={cn(
              "flex justify-between items-center", // Layout, Flexbox & Grid
              "container h-12 transition-all duration-300", // Sizing, Transitions & Animation
              showBacking || sticking
                ? "border-zinc-200 dark:border-zinc-800"
                : "bg-transparent border-transparent shadow-none",
              className
            )}
          >
            {children}
          </Card>
        </HeaderSection>
      </div>
    </>
  );
};

export default Header;
