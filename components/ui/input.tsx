import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex", // Layout
          "w-full h-9", // Sizing
          "text-base file:text-sm md:text-sm file:font-medium", // Typography
          "bg-transparent file:bg-transparent", // Backgrounds
          "rounded-md border file:border-0 focus-visible:outline-hidden", // Borders
          "shadow-xs focus-visible:ring-1 disabled:opacity-50", // Effects
          "transition-colors", // Transitions & Animation
          "disabled:cursor-not-allowed", // Interactivity
          "border-input px-3 py-1 file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive", // Etc.
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
