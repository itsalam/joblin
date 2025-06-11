"use client";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { LoginForm } from "../forms/login-form";
import { SignUpForm } from "../forms/signup-form";
import { Button } from "../ui/button";

export default function LoginNavModal({}: Readonly<{}>) {
  const [value, setValue] = useState<string>();
  const { data: session, status } = useSession();

  return (
    <NavigationMenu value={value} className="ml-auto">
      {status === "authenticated" ? (
        <>
          <p>{`Welcome ${session.user?.email}`}</p>
          <Button onClick={() => signOut()}> Sign Out </Button>
        </>
      ) : (
        <NavigationMenuList>
          <NavigationMenuItem value={"login"}>
            <NavigationMenuTrigger
              onClick={() => setValue("login")}
              hideChevron
              className={cn(navigationMenuTriggerStyle())}
            >
              Log in
            </NavigationMenuTrigger>
            <NavigationMenuContent
              onClick={() => setValue("login")}
              onPointerDownOutside={(e) => setValue(undefined)}
            >
              <LoginForm className="flex w-[24rem] border-none rounded-[inherit] flex-col gap-6" />
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="signup">
            <NavigationMenuTrigger
              onClick={() => setValue("signup")}
              hideChevron
              className={cn(
                "mr-6",
                navigationMenuTriggerStyle({ intent: "secondary" })
              )}
            >
              Sign up
            </NavigationMenuTrigger>
            <NavigationMenuContent
              onClick={() => setValue("signup")}
              onPointerDownOutside={(e) => setValue(undefined)}
            >
              <SignUpForm className="flex border-none rounded-[inherit] flex-col gap-6" />
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      )}
    </NavigationMenu>
  );
}
