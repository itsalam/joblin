"use client";

"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { Asterisk, Check, ChevronLeft, Hash, WholeWord } from "lucide-react";
import { ChangeEventHandler, ComponentProps, useState } from "react";
import { SubmitErrorHandler, useFormContext } from "react-hook-form";
import { z } from "zod";
import InputField from "../../ui/input-field";
import { LoadingButton } from "../../ui/loading-button";
import { useSignUpContext } from "./context";
import {
  ErrorMessages,
  FormSchema,
  PasswordErrorFlags,
  PasswordErrorKeys,
  PasswordErrorMessages,
} from "./schema";
import SignUpPage from "./sign-up-page";

// Select only password-related keys

const passwordSchema = FormSchema.innerType().shape.password;

const getErrorsForValue = (schema: z.ZodTypeAny, value: any) => {
  const result = schema.safeParse(value);
  if (result.success) return []; // No errors

  return result.error.issues.map((issue) => issue.message);
};

export function ManualSignUpFormB({
  className,
}: React.ComponentPropsWithoutRef<"div">) {
  const { control, setError, trigger, handleSubmit, formState } =
    useFormContext<z.infer<typeof FormSchema>>();
  const { goToPage, passwordReqs, setPasswordReqs, setUserUuid } =
    useSignUpContext();

  const [fetching, setIsFetching] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = (data: z.infer<typeof FormSchema>) => {
    setIsFetching(true);
    const { ["confirm-password"]: _, ...emailData } = data;
    const response = fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailData),
    })
      .then((resp) => {
        return resp.json();
      })
      .then((data) => {
        alert(data.message || data.error);
        if (data.user) {
          setUserUuid(data.user as string);
        }
        setIsFetching(false);
        if (!data.error) {
          goToPage(2);
        }
      });
  };

  const onError: SubmitErrorHandler<z.infer<typeof FormSchema>> = (e) => {
    trigger(["password", "confirm-password"]).then((value) => {
      const messages = formState.errors.password
        ?.message as PasswordErrorMessages;
      if (messages) {
        if (passwordReqs[messages] !== undefined) {
          passwordReqs[messages] = -1;
          setPasswordReqs({ ...passwordReqs });
        }
      } else {
        (Object.keys(e) as Array<keyof z.infer<typeof FormSchema>>).forEach((
          field
        ) => {
          setError(field, {
            type: "manual",
            message: e[field]?.message,
          });
        });
      }
    });
  };

  const updatePasswordReqs: ChangeEventHandler<HTMLInputElement> = (e) => {
    const errors = getErrorsForValue(
      passwordSchema,
      e.target.value
    ) as PasswordErrorMessages[];
    setPasswordReqs(
      (prevReqs) =>
        Object.fromEntries(
          Object.entries(prevReqs).map(([key, _]) => [
            key,
            errors.includes(key as PasswordErrorMessages) ? 0 : 1, // 1 if satisfied, 0 if error exists
          ])
        ) as PasswordErrorFlags
    );
  };

  const PasswordReqWrapper = ({
    className,
    passwordReq,
    asChild,
    ...props
  }: ComponentProps<"div"> & {
    passwordReq: PasswordErrorKeys;
    asChild?: boolean;
  }) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        className={cn(
          className,
          {
            "text-green-400": passwordReqs[ErrorMessages[passwordReq]] === 1,
            "text-red-400": passwordReqs[ErrorMessages[passwordReq]] === -1,
          }
        )}
        {...props}
      />
    );
  };

  const PasswordReqsIcons = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center relative translate-y-2">
          <PasswordReqWrapper passwordReq="PASSWORD_MIN_LENGTH">
            <WholeWord />
          </PasswordReqWrapper>
          <PasswordReqWrapper
            passwordReq="PASSWORD_UPPERCASE"
            className="pl-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="24"
              viewBox="0 0 12 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 15 4-8 4 8"></path>
              <path d="M4 13h6"></path>
            </svg>
          </PasswordReqWrapper>
          <PasswordReqWrapper passwordReq="PASSWORD_LOWERCASE" className="pr-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="24"
              viewBox="12 0 12 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="12" r="3"></circle>
              <path d="M21 9v6"></path>
            </svg>
          </PasswordReqWrapper>
          <PasswordReqWrapper passwordReq="PASSWORD_SPECIAL_CHAR">
            <Asterisk size={24} viewBox="-4 -4 32 32" strokeWidth={2.5} />
          </PasswordReqWrapper>
          <PasswordReqWrapper passwordReq="PASSWORD_NUMBER">
            <Hash size={24} viewBox="-10 -10 44 44" strokeWidth={3} />
          </PasswordReqWrapper>
        </TooltipTrigger>
        <TooltipContent>
          <p className="pb-1.5">Requirements:</p>
          <ul className="flex flex-col gap-1">
            <PasswordReqWrapper passwordReq="PASSWORD_MIN_LENGTH" asChild>
              <li className="before:content-['•'] before:mr-1">
                At least 8 characters long.
              </li>
            </PasswordReqWrapper>
            <PasswordReqWrapper passwordReq="PASSWORD_UPPERCASE" asChild>
              <li className="before:content-['•'] before:mr-1">
                Contain at least one uppercase.
              </li>
            </PasswordReqWrapper>
            <PasswordReqWrapper passwordReq="PASSWORD_LOWERCASE" asChild>
              <li className="before:content-['•'] before:mr-1">
                Contain at least one lowercase.
              </li>
            </PasswordReqWrapper>
            <PasswordReqWrapper passwordReq="PASSWORD_NUMBER" asChild>
              <li className="before:content-['•'] before:mr-1">
                Contain at least one number.
              </li>
            </PasswordReqWrapper>
            <PasswordReqWrapper passwordReq="PASSWORD_SPECIAL_CHAR" asChild>
              <li className="before:content-['•'] before:mr-1">
                Contain at least one special character (@$!%*?&)..
              </li>
            </PasswordReqWrapper>
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <SignUpPage>
      <form onSubmit={handleSubmit(handleSignUp, onError)}>
        <div className="grid gap-6">
          <InputField
            name="password"
            type="password"
            label="Password"
            control={control}
            onChange={updatePasswordReqs}
          >
            <PasswordReqsIcons />
          </InputField>

          <InputField
            name="confirm-password"
            type="password"
            label="Confirm Password"
            control={control}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={"secondary"}
              size={"icon"}
              className="aspect-square"
              onClick={() => goToPage(0)}
            >
              <ChevronLeft />
            </Button>
            <LoadingButton type="submit" className="w-full" loading={fetching}>
              Submit <Check />
            </LoadingButton>
          </div>
        </div>
      </form>
    </SignUpPage>
  );
}
