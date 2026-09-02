import { budgetKeys } from "./keys";
import { budgetAmountSchema, monthlyBudgetSuggestions } from "./schemas";

describe("budgets", () => {
  it("nests keys under the feature root", () => {
    expect(budgetKeys.list()[0]).toBe("budgets");
  });

  it("requires a positive amount and scales suggestions by currency", () => {
    expect(budgetAmountSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(budgetAmountSchema.safeParse({ amount: 2_000_000 }).success).toBe(true);
    expect(monthlyBudgetSuggestions(0)).toEqual([1_500_000, 2_000_000, 3_000_000]);
    expect(monthlyBudgetSuggestions(2)).toEqual([1500, 2000, 3000]);
  });
});
