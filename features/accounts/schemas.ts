import { z } from "zod";

import { MAX_AMOUNT } from "@/lib/format/money";
import { COLOR_TOKENS } from "@/lib/theme/feature-color";
import type { components } from "@/types/api";

export const ACCOUNT_TYPES = [
  "CASH",
  "ACCOUNT",
  "CARD",
  "DEBIT_CARD",
  "SAVINGS",
  "INVESTMENT",
  "OVERDRAFT",
  "LOAN",
  "OTHER",
] as const satisfies readonly components["schemas"]["CreateAccountInput"]["type"][];

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_NAME_MAX = 255;

export const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(ACCOUNT_NAME_MAX, { error: "validation.nameMax" }),
  type: z.enum(ACCOUNT_TYPES, { error: "validation.required" }),
  balance: z
    .number({ error: "validation.amountInvalid" })
    .min(-MAX_AMOUNT, { error: "validation.amountMax" })
    .max(MAX_AMOUNT, { error: "validation.amountMax" })
    .nullable(),
  color: z.enum(COLOR_TOKENS, { error: "validation.required" }),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
