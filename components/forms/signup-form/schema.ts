import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

export enum ErrorMessages {
  INVALID_EMAIL = "Invalid email format.",
  NAME_REQUIRED = "Name is required.",
  PASSWORD_MIN_LENGTH = "must be at least 8 characters long.",
  MAX_LENGTH = "Password cannot exceed 128 characters.",
  PASSWORD_LOWERCASE = "must contain at least one lowercase letter.",
  PASSWORD_UPPERCASE = "must contain at least one uppercase letter.",
  PASSWORD_NUMBER = "must contain at least one number.",
  PASSWORD_SPECIAL_CHAR = "must contain at least one special character (@$!%*?&).",
  PASSWORDS_DO_NOT_MATCH = "Passwords do not match.",
}

export const FormSchema = z
  .object({
    email: z.string().email({ message: ErrorMessages.INVALID_EMAIL }),
    name: z.string().min(1, { message: ErrorMessages.NAME_REQUIRED }),
    password: z
      .string()
      .min(8, { message: ErrorMessages.PASSWORD_MIN_LENGTH })
      .max(128, { message: ErrorMessages.MAX_LENGTH }) // Cognito max length
      .regex(/[a-z]/, {
        message: ErrorMessages.PASSWORD_LOWERCASE,
      })
      .regex(/[A-Z]/, {
        message: ErrorMessages.PASSWORD_UPPERCASE,
      })
      .regex(/\d/, { message: ErrorMessages.PASSWORD_NUMBER })
      .regex(/[@$!%*?&]/, {
        message: ErrorMessages.PASSWORD_SPECIAL_CHAR,
      }),
    "confirm-password": z.string(),
  })
  .refine((data) => data.password === data["confirm-password"], {
    message: ErrorMessages.PASSWORDS_DO_NOT_MATCH,
    path: ["confirm-password"], // Attach error to confirmPassword field
  });

// Select only password-related keys
export type PasswordErrorKeys = Extract<
  keyof typeof ErrorMessages,
  `PASSWORD_${string}`
>;

export type PasswordErrorMessages = (typeof ErrorMessages)[PasswordErrorKeys];

export type PasswordErrorFlags = {
  [K in PasswordErrorMessages]: number;
};

export const useSignUpForm = () => {
  return useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    shouldUnregister: false,
  });
};
