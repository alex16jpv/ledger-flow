import { MAX_AMOUNT } from "@/lib/format/money";
import { z } from "@/lib/validation/zod";

export const DESCRIPTION_MAX = 255;

export const quickAddSchema = z.object({
  amount: z
    .number({ error: "validation.amountInvalid" })
    .positive({ error: "validation.amountPositive" })
    .max(MAX_AMOUNT, { error: "validation.amountMax" }),
  categoryId: z.string().nullable(),
  accountId: z.string().nullable(),
  description: z.string().trim().max(DESCRIPTION_MAX, { error: "validation.nameMax" }),
});

export type QuickAddValues = z.infer<typeof quickAddSchema>;

export interface QuickAddDraft {
  amount: number | null;
  categoryId: string | null;
  accountId: string | null;
  description: string;
}

export function draftToSearchParams(draft: QuickAddDraft): URLSearchParams {
  const params = new URLSearchParams();
  if (draft.amount !== null && Number.isFinite(draft.amount))
    params.set("amount", String(draft.amount));
  if (draft.categoryId) params.set("categoryId", draft.categoryId);
  if (draft.accountId) params.set("accountId", draft.accountId);
  if (draft.description.trim()) params.set("description", draft.description.trim());
  return params;
}
