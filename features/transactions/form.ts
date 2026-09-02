import { z } from "zod";

import { dateTimeInstant, dateTimeParts } from "@/lib/format/dates";
import { MAX_AMOUNT } from "@/lib/format/money";
import type {
  components,
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from "@/types/api";

export const TRANSACTION_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "ADJUSTMENT",
] as const satisfies readonly CreateTransactionInput["type"][];

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type AdjustmentDirection = "increase" | "decrease";

export const TEXT_MAX = 255;
export const FUTURE_LIMIT_MS = 24 * 60 * 60 * 1000;

export const transactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z
      .number({ error: "validation.amountInvalid" })
      .positive({ error: "validation.amountPositive" })
      .max(MAX_AMOUNT, { error: "validation.amountMax" }),
    categoryId: z.string().nullable(),
    accountId: z.string().nullable(),
    fromAccountId: z.string().nullable(),
    toAccountId: z.string().nullable(),
    direction: z.enum(["increase", "decrease"]),
    date: z.string().min(1, { error: "validation.required" }),
    time: z.string().nullable(),
    description: z.string().trim().max(TEXT_MAX, { error: "validation.nameMax" }),
    tags: z.array(z.string()),
    note: z.string().trim().max(TEXT_MAX, { error: "validation.nameMax" }),
  })
  .superRefine((values, context) => {
    if (values.type === "TRANSFER") {
      if (!values.fromAccountId)
        context.addIssue({
          code: "custom",
          path: ["fromAccountId"],
          message: "validation.required",
        });
      if (!values.toAccountId)
        context.addIssue({ code: "custom", path: ["toAccountId"], message: "validation.required" });
      if (values.fromAccountId && values.fromAccountId === values.toAccountId)
        context.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "validation.sameAccount",
        });
    } else if (!values.accountId) {
      context.addIssue({ code: "custom", path: ["accountId"], message: "validation.required" });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function categoryAllowed(type: TransactionType): type is "EXPENSE" | "INCOME" {
  return type === "EXPENSE" || type === "INCOME";
}

export function defaultFormValues(now: Date, timeZone: string): TransactionFormValues {
  return {
    type: "EXPENSE",
    amount: Number.NaN,
    categoryId: null,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    direction: "increase",
    ...dateTimeParts(now, timeZone),
    description: "",
    tags: [],
    note: "",
  };
}

export interface FormDraft {
  amount?: number;
  categoryId?: string;
  accountId?: string;
  description?: string;
}

export function draftFromSearchParams(params: URLSearchParams): FormDraft {
  const amount = Number(params.get("amount"));
  return {
    ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
    ...(params.get("categoryId") ? { categoryId: params.get("categoryId") ?? undefined } : {}),
    ...(params.get("accountId") ? { accountId: params.get("accountId") ?? undefined } : {}),
    ...(params.get("description") ? { description: params.get("description") ?? undefined } : {}),
  };
}

export function isTooFarAhead(
  values: Pick<TransactionFormValues, "date" | "time">,
  timeZone: string,
  now: Date,
): boolean {
  return dateTimeInstant(values, timeZone, now).getTime() - now.getTime() > FUTURE_LIMIT_MS;
}

function accountSides(values: TransactionFormValues): {
  fromAccountId: string | null;
  toAccountId: string | null;
} {
  switch (values.type) {
    case "EXPENSE":
      return { fromAccountId: values.accountId, toAccountId: null };
    case "INCOME":
      return { fromAccountId: null, toAccountId: values.accountId };
    case "TRANSFER":
      return { fromAccountId: values.fromAccountId, toAccountId: values.toAccountId };
    case "ADJUSTMENT":
      return values.direction === "increase"
        ? { fromAccountId: null, toAccountId: values.accountId }
        : { fromAccountId: values.accountId, toAccountId: null };
  }
}

// The same payload serves POST and PUT: PUT merges, so the unused side and category are sent as explicit nulls.
export function toTransactionInput(
  values: TransactionFormValues,
  timeZone: string,
  now: Date = new Date(),
): CreateTransactionInput & UpdateTransactionInput {
  return {
    type: values.type,
    amount: values.amount,
    date: dateTimeInstant(values, timeZone, now).toISOString(),
    categoryId: categoryAllowed(values.type) ? values.categoryId : null,
    ...accountSides(values),
    description: values.description.trim() || null,
    tags: values.tags,
    note: values.note.trim() || null,
  };
}

export function fromTransaction(transaction: Transaction, timeZone: string): TransactionFormValues {
  const single =
    transaction.type === "TRANSFER" ? null : (transaction.fromAccountId ?? transaction.toAccountId);
  return {
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    accountId: single,
    fromAccountId: transaction.type === "TRANSFER" ? transaction.fromAccountId : null,
    toAccountId: transaction.type === "TRANSFER" ? transaction.toAccountId : null,
    direction:
      transaction.type === "ADJUSTMENT" && transaction.fromAccountId ? "decrease" : "increase",
    ...dateTimeParts(new Date(transaction.date), timeZone),
    description: transaction.description ?? "",
    tags: transaction.tags,
    note: transaction.note ?? "",
  };
}

export type TransactionTypeFilter = components["schemas"]["Transaction"]["type"];
