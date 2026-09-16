import { MAX_AMOUNT } from "@/lib/format/money";
import { type Infer, z } from "@/lib/validation/zod";
import type { QuickAddTransactionInput } from "@/types/api";

export const DESCRIPTION_MAX = 255;

export const QUICK_TYPES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
] as const satisfies readonly NonNullable<QuickAddTransactionInput["type"]>[];

export type QuickAddType = (typeof QUICK_TYPES)[number];

export const quickAddSchema = z
  .object({
    type: z.enum(QUICK_TYPES),
    amount: z
      .number({ error: "validation.amountInvalid" })
      .positive({ error: "validation.amountPositive" })
      .max(MAX_AMOUNT, { error: "validation.amountMax" }),
    categoryId: z.string().nullable(),
    accountId: z.string().nullable(),
    toAccountId: z.string().nullable(),
    description: z.string().trim().max(DESCRIPTION_MAX, { error: "validation.nameMax" }),
  })
  .superRefine((values, context) => {
    if (values.type !== "TRANSFER") return;
    if (!values.accountId)
      context.addIssue({ code: "custom", path: ["accountId"], message: "validation.required" });
    if (!values.toAccountId)
      context.addIssue({ code: "custom", path: ["toAccountId"], message: "validation.required" });
    if (values.accountId && values.accountId === values.toAccountId)
      context.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "validation.sameAccount",
      });
  });

export type QuickAddValues = Infer<typeof quickAddSchema>;

export interface QuickAddDraft {
  type: QuickAddType;
  amount: number | null;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string;
}

export function draftToSearchParams(draft: QuickAddDraft): URLSearchParams {
  const params = new URLSearchParams();
  params.set("type", draft.type);
  if (draft.amount !== null && Number.isFinite(draft.amount))
    params.set("amount", String(draft.amount));
  if (draft.categoryId) params.set("categoryId", draft.categoryId);
  if (draft.accountId) params.set("accountId", draft.accountId);
  if (draft.toAccountId) params.set("toAccountId", draft.toAccountId);
  if (draft.description.trim()) params.set("description", draft.description.trim());
  return params;
}

export function quickAddInput(values: QuickAddValues): QuickAddTransactionInput {
  const { type, amount, categoryId, accountId, toAccountId } = values;
  return {
    amount,
    type,
    ...(categoryId ? { categoryId } : {}),
    ...(accountId && type !== "INCOME" ? { fromAccountId: accountId } : {}),
    ...(type === "INCOME" && accountId ? { toAccountId: accountId } : {}),
    ...(type === "TRANSFER" && toAccountId ? { toAccountId } : {}),
  };
}
