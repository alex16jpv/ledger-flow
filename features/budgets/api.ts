import { api } from "@/lib/api/client";
import type { Budget, BudgetList, CreateBudgetInput } from "@/types/api";

export function fetchBudgets(
  params: { reference?: string; includeExpired?: boolean } = {},
): Promise<BudgetList> {
  return api<BudgetList>("/budgets", {
    query: {
      reference: params.reference,
      includeExpired: params.includeExpired ? "true" : undefined,
      limit: 100,
    },
  });
}

export function createBudget(input: CreateBudgetInput): Promise<Budget> {
  return api<Budget>("/budgets", { method: "POST", body: input });
}
