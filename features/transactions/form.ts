import { dateTimeInstant, dateTimeParts } from "@/lib/format/dates";
import { MAX_AMOUNT } from "@/lib/format/money";
import { type Infer, z } from "@/lib/validation/zod";
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

// T-85: an adjustment repairs a balance, so it is made and edited in the account, not in this form.
export const FORM_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
] as const satisfies readonly TransactionType[];

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type FormTransactionType = (typeof FORM_TYPES)[number];

export const TEXT_MAX = 255;
export const FUTURE_LIMIT_MS = 24 * 60 * 60 * 1000;

export const transactionFormSchema = z
  .object({
    type: z.enum(FORM_TYPES),
    amount: z
      .number({ error: "validation.amountInvalid" })
      .positive({ error: "validation.amountPositive" })
      .max(MAX_AMOUNT, { error: "validation.amountMax" }),
    categoryId: z.string().nullable(),
    accountId: z.string().nullable(),
    fromAccountId: z.string().nullable(),
    toAccountId: z.string().nullable(),
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

export type TransactionFormValues = Infer<typeof transactionFormSchema>;

export function defaultFormValues(now: Date, timeZone: string): TransactionFormValues {
  return {
    type: "EXPENSE",
    amount: Number.NaN,
    categoryId: null,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    ...dateTimeParts(now, timeZone),
    description: "",
    tags: [],
    note: "",
  };
}

export interface FormDraft {
  type?: FormTransactionType;
  amount?: number;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  description?: string;
}

function draftType(value: string | null): FormTransactionType | undefined {
  return FORM_TYPES.find((type) => type === value);
}

export function draftFromSearchParams(params: URLSearchParams): FormDraft {
  const amount = Number(params.get("amount"));
  const type = draftType(params.get("type"));
  return {
    ...(type ? { type } : {}),
    ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
    ...(params.get("categoryId") ? { categoryId: params.get("categoryId") ?? undefined } : {}),
    ...(params.get("accountId") ? { accountId: params.get("accountId") ?? undefined } : {}),
    ...(params.get("toAccountId") ? { toAccountId: params.get("toAccountId") ?? undefined } : {}),
    ...(params.get("description") ? { description: params.get("description") ?? undefined } : {}),
  };
}

export function draftToFormValues(
  draft: FormDraft,
  base: TransactionFormValues,
): TransactionFormValues {
  const type = draft.type ?? base.type;
  return {
    ...base,
    type,
    ...(draft.amount !== undefined ? { amount: draft.amount } : {}),
    categoryId: draft.categoryId ?? null,
    accountId: type === "TRANSFER" ? null : (draft.accountId ?? null),
    fromAccountId: type === "TRANSFER" ? (draft.accountId ?? null) : null,
    toAccountId: type === "TRANSFER" ? (draft.toAccountId ?? null) : null,
    description: draft.description ?? "",
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
    categoryId: values.categoryId,
    ...accountSides(values),
    description: values.description.trim() || null,
    tags: values.tags,
    note: values.note.trim() || null,
  };
}

// §6 O-F5a: the queue classifies a conflict by the fields the operation carries (§1 example 3).
const OWNED_BY: Record<keyof TransactionFormValues, readonly (keyof UpdateTransactionInput)[]> = {
  // The type decides whether a category is allowed and which side each account goes on.
  type: ["type", "categoryId", "fromAccountId", "toAccountId"],
  amount: ["amount"],
  categoryId: ["categoryId"],
  accountId: ["fromAccountId", "toAccountId"],
  fromAccountId: ["fromAccountId", "toAccountId"],
  toAccountId: ["fromAccountId", "toAccountId"],
  date: ["date"],
  time: ["date"],
  description: ["description"],
  tags: ["tags"],
  note: ["note"],
};

export type TouchedFields = Partial<Record<keyof TransactionFormValues, unknown>>;

// RHF marks a field dirty only while it differs from the opening value, so a round trip is not.
export function toTransactionChanges(
  input: CreateTransactionInput & UpdateTransactionInput,
  touched: TouchedFields,
): UpdateTransactionInput {
  const wanted = new Set<string>();
  for (const [field, dirty] of Object.entries(touched)) {
    if (!dirty) continue;
    for (const key of OWNED_BY[field as keyof TransactionFormValues]) wanted.add(key);
  }
  return Object.fromEntries(Object.entries(input).filter(([key]) => wanted.has(key)));
}

export type FormTransaction = Omit<Transaction, "type"> & { type: FormTransactionType };

export function isFormTransaction(transaction: Transaction): transaction is FormTransaction {
  return FORM_TYPES.some((type) => type === transaction.type);
}

export function fromTransaction(
  transaction: FormTransaction,
  timeZone: string,
): TransactionFormValues {
  const single =
    transaction.type === "TRANSFER" ? null : (transaction.fromAccountId ?? transaction.toAccountId);
  return {
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    accountId: single,
    fromAccountId: transaction.type === "TRANSFER" ? transaction.fromAccountId : null,
    toAccountId: transaction.type === "TRANSFER" ? transaction.toAccountId : null,
    ...dateTimeParts(new Date(transaction.date), timeZone),
    description: transaction.description ?? "",
    tags: transaction.tags,
    note: transaction.note ?? "",
  };
}

export type TransactionTypeFilter = components["schemas"]["Transaction"]["type"];
