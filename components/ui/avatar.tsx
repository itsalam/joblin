"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "flex overflow-hidden relative shrink-0 w-10 h-10 rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof Image>,
  React.ComponentPropsWithoutRef<typeof Image>
>(({ className, ...props }, ref) => (
  <Image
    ref={ref}
    className={cn(
      "aspect-square w-full h-full",
      className
    )}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex justify-center items-center w-full h-full", // Layout, Flexbox & Grid, Sizing
      "rounded-full bg-muted", // Borders, Etc.
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
