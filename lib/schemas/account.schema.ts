import { z } from "zod";
import { type AccountKind } from "@/utils/constants";

const ACCOUNT_TYPE_VALUES: [AccountKind, ...AccountKind[]] = [
  "CASH",
  "ACCOUNT",
  "CARD",
  "DEBIT_CARD",
  "SAVINGS",
  "INVESTMENT",
  "OVERDRAFT",
  "LOAN",
  "OTHER",
];

export const createAccountSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
  type: z.enum(ACCOUNT_TYPE_VALUES, {
    message: "Account type is required",
  }),
  balance: z
    .number({ message: "Balance is required" })
    .finite("Balance must be a finite number"),
});

export type CreateAccountFormFields = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, "Name must not be empty")
    .max(255, "Name must be 255 characters or less"),
  type: z.enum(ACCOUNT_TYPE_VALUES, {
    message: "Account type is required",
  }),
});

export type UpdateAccountFormFields = z.infer<typeof updateAccountSchema>;
