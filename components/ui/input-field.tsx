"use client";

import { Input } from "@/components/ui/input";
import {
  ComponentProps
} from "react";
import { Control, FieldValues, Path } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "./form";


const InputField = <T extends FieldValues>({
    label,
    name,
    children,
    control,
    ...inputProps
  }: ComponentProps<typeof Input> & {
    label: string;
    control: Control<T>;
    name: Path<T>;
  }) => {
    return (
      <FormField
        control={control}
        name={name}
        key={name}
        render={({ field }) => (
          <FormItem className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <FormLabel>{label}</FormLabel>
              {children ? children : <FormMessage />}
            </div>
            <FormControl>
              <Input
                {...inputProps}
                {...field}
                onChange={(e) => {
                  field.onChange(e); // Call React Hook Form's onChange
                  inputProps.onChange?.(e); // Call user-defined onChange if provided
                }}
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  }

export default InputField;