import { type Infer, z } from "@/lib/validation/zod";

export const budgetAmountSchema = z.object({
  amount: z
    .number({ error: "validation.amountPositive" })
    .positive({ error: "validation.amountPositive" }),
});

export type BudgetAmountValues = Infer<typeof budgetAmountSchema>;
