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

export function fetchBudgetSpending(params: BudgetSpendingParams): Promise<StatsResponse> {
  return readSpending({
    type: params.type,
    groupBy: params.groupBy,
    from: params.from,
    to: params.to,
    ...(params.categoryIds.length > 0 ? { categoryIds: params.categoryIds.join(",") } : {}),
  });
}

export async function fetchBudgetHistory(
  id: string,
  periodFrom: string,
  count: number,
  readPeriod: (reference: string) => Promise<Budget>,
): Promise<Budget[]> {
  const history: Budget[] = [];
  let start = Date.parse(periodFrom);
  for (let step = 0; step < count; step += 1) {
    if (!Number.isFinite(start)) break;
    // One millisecond before a period starts falls inside the one before it, whatever its length.
    const previous = await readPeriod(new Date(start - 1).toISOString());
    const next = Date.parse(previous.periodFrom);
    if (!Number.isFinite(next) || next >= start) break;
    if (Date.parse(previous.periodTo) <= Date.parse(previous.effectiveFrom)) break;
    history.push(previous);
    start = next;
  }
  return history.reverse();
}
