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

const Header = ({ children }: { children?: ReactNode }) => {
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
      <div id="header-sentinel" className="h-0" />
      <div className="p-1.5 px-3 sticky top-0 z-10" key="header">
        <HeaderSection
          className={cn(
            "top-0 left-0 z-50", // Layout
            "w-full opacity-0 translate-y-[-1rem] mb-0", // Sizing, Effects, Transforms, Margin
            "pb-1.5 animate-fade-in border-b [--animation-delay:600ms]", // Etc.
            sticking ? "border-transparent" : ""
          )}
        >
          <Card
            className={cn(
              "flex overflow-hidden", // Layout
              "justify-between items-center container h-12", // Flexbox & Grid, Sizing
              "transition-all duration-300", // Transitions & Animation
              sticking
                ? "border-zinc-200 dark:border-zinc-800"
                : "bg-transparent border-transparent shadow-none"
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
