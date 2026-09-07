import { z } from "@/lib/validation/zod";

export const budgetAmountSchema = z.object({
  amount: z
    .number({ error: "validation.amountPositive" })
    .positive({ error: "validation.amountPositive" }),
});

export type BudgetAmountValues = z.infer<typeof budgetAmountSchema>;
