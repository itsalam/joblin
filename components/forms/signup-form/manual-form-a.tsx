"use client";

import { Button } from "@/components/ui/button";
import { UserType } from "@aws-sdk/client-cognito-identity-provider";
import { ChevronRight } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import InputField from "../../ui/input-field";
import { useSignUpContext } from "./context";
import { FormSchema } from "./schema";
import SignUpPage from "./sign-up-page";

export function ManualSignUpFormA({
  className,
} //   ...props
: React.ComponentPropsWithoutRef<"div">) {
  const { control, setError, trigger, getValues, handleSubmit } =
    useFormContext<z.infer<typeof FormSchema>>();
  const { goToPage, setUserUuid } = useSignUpContext();

  const handleNextButton = (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();

    trigger(["name", "email"]).then(async (success) => {
      const email = getValues().email;
      const { user } = (await fetch("/api/auth/find-acc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((res) => res.json())) as { user: UserType | undefined };

      if (user?.UserStatus === "UNCONFIRMED") {
        //Resend otp and go to other pages
        setUserUuid(user.Username);
        await fetch("/api/auth/resend-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user }),
        })
          .then(async (res) => {
            if (!res.ok) {
              // Fetch API considers only network failures as errors, so manually check response status
              const errorData = await res.json(); // Read error details from response
              throw new Error(
                errorData.message || `Request failed with status ${res.status}`
              );
            }
            return res.json();
          })
          .then((json) => {
            goToPage(2);
          });
      } else if (user) {
        setError("email", { message: "Account Email already exists." });
        // TODO: Alert, user found and not unconfirmed.
      } else if (success) {
        goToPage(1);
      }
    });
  };

  return (
    <SignUpPage>
      <form className="grid gap-6" onSubmit={(e) => handleNextButton(e)}>
        <InputField control={control} label="Name" name="name" />
        <InputField control={control} label="Email" name="email" />
        <div className="grid gap-6">
          <Button type="submit" className="w-full">
            Next <ChevronRight />
          </Button>
        </div>
      </form>
    </SignUpPage>
  );
}
