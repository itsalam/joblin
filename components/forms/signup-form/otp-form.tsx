"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFormContext } from "react-hook-form";
import { z } from "zod";

// import { toast } from "@/components/hooks/use-toast"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { LoadingButton } from "@/components/ui/loading-button";
import { Check } from "lucide-react";
import { useState } from "react";
import { useSignUpContext } from "./context";
import { FormSchema } from "./schema";

const OTPSchema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export function OTPForm({ email }: { email?: string }) {
  const { userUuid } = useSignUpContext();
  const { getValues } =
      useFormContext<z.infer<typeof FormSchema>>();
  const form = useForm<z.infer<typeof OTPSchema>>({
    resolver: zodResolver(OTPSchema),
    defaultValues: {
      otp: "",
    },
  });

  const [fetching, setIsFetching] = useState<boolean>(false);

  function onSubmit(data: z.infer<typeof OTPSchema>) {
    setIsFetching(true);
    const { otp } = data;
    if (!otp) return; //TODO: make a fuss about this
    const response = fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username:userUuid, otp }),
    })
      .then((resp) => {
        if(resp.ok){
          return resp.json();
        } else {
          // Create an alert component
          throw(resp.statusText)
        }
      })
      .then((data) => {
        if(!data.error){
          console.log(getValues());
          const signIn = fetch("/api/auth/signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password:getValues().password }),
          }).then((resp) => 
            resp.json()
          ).then((json) => {
            console.log(json);
          })
        }
        alert(data.message || data.error);
        setIsFetching(false);
      });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <FormField
          control={form.control}
          name="otp"
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel>{`A One-Time Password has been sent to ${email}`}</FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field} className="mx-auto">
                  <InputOTPGroup className="mx-auto">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormDescription>
                Please enter the password sent to your phone.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <LoadingButton type="submit" className="w-full" loading={fetching}>
          Submit <Check />
        </LoadingButton>
      </form>
    </Form>
  );
}
