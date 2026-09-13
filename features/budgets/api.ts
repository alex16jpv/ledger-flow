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

export interface BudgetSpendingParams {
  type: Budget["type"];
  categoryIds: readonly string[];
  from: string;
  to: string;
  groupBy: "day" | "category";
}

// A budget holds the whole of each of its categories, so its own figures are Stats' own figures.
export function fetchBudgetSpending(params: BudgetSpendingParams): Promise<StatsResponse> {
  return readSpending({
    type: params.type,
    groupBy: params.groupBy,
    from: params.from,
    to: params.to,
    ...(params.categoryIds.length > 0 ? { categoryIds: params.categoryIds.join(",") } : {}),
  });
}

// Each period's limit is its own, so the history is the budget itself read once per period; one
// millisecond before a period starts falls inside the one before it, whatever its length.
export async function fetchBudgetHistory(
  id: string,
  periodFrom: string,
  count: number,
): Promise<Budget[]> {
  const history: Budget[] = [];
  let start = Date.parse(periodFrom);
  for (let step = 0; step < count; step += 1) {
    if (!Number.isFinite(start)) break;
    const previous = await readBudget(id, new Date(start - 1).toISOString());
    const next = Date.parse(previous.periodFrom);
    // Not an earlier window is not history: it would draw the same period twice, or walk for ever.
    if (!Number.isFinite(next) || next >= start) break;
    // A period that ends before the budget began is padding, not a period this budget lived through.
    if (Date.parse(previous.periodTo) <= Date.parse(previous.effectiveFrom)) break;
    history.push(previous);
    start = next;
  }
  return history.reverse();
}
