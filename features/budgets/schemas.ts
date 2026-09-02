import { z } from "zod";

export const budgetAmountSchema = z.object({
  amount: z
    .number({ error: "validation.amountPositive" })
    .positive({ error: "validation.amountPositive" }),
});

export type BudgetAmountValues = z.infer<typeof budgetAmountSchema>;

// Suggestions scale with the currency's minor unit: zero-decimal currencies (COP, JPY) use larger nominal amounts.
export function monthlyBudgetSuggestions(fractionDigits: number): number[] {
  return fractionDigits === 0 ? [1_500_000, 2_000_000, 3_000_000] : [1500, 2000, 3000];
}
