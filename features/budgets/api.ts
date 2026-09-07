import {
  type BudgetListParams,
  readBudget,
  readBudgets,
  readSpending,
} from "@/lib/local/repository";
import type { Budget, StatsResponse } from "@/types/api";

export type BudgetFilters = Omit<BudgetListParams, "limit">;

// Reads go through the repository, which answers from the mirror while offline; writes go through
// the outbox, which queues the operation with the row and answers from the projection (O-F4).
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
