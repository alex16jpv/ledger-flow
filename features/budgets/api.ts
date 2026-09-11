import {
  type BudgetListParams,
  readBudget,
  readBudgets,
  readSpending,
} from "@/lib/local/repository";
import type { Budget, StatsResponse } from "@/types/api";

export type BudgetFilters = Omit<BudgetListParams, "limit">;

// O-F4: reads go through the repository (mirror fallback); writes go through the outbox.
export {
  archiveBudget,
  createBudget,
  removeBudgetOverride,
  restoreBudget,
  setBudgetOverride,
  updateBudget,
} from "@/lib/local/outbox";

export function fetchBudgets(filters: BudgetFilters = {}): Promise<Budget[]> {
  return readBudgets(filters);
}

export function fetchBudget(id: string, reference?: string): Promise<Budget> {
  return readBudget(id, reference);
}

export function fetchSpendingTotal(from: string, to: string): Promise<StatsResponse> {
  return readSpending({ type: "EXPENSE", from, to });
}
