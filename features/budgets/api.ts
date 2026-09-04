import { api } from "@/lib/api/client";
import { type BudgetListParams, readBudget, readBudgets } from "@/lib/local/repository";
import type {
  Budget,
  BudgetAmountOverrideInput,
  BudgetList,
  CreateBudgetInput,
  StatsResponse,
  UpdateBudgetInput,
} from "@/types/api";

export type BudgetFilters = Omit<BudgetListParams, "limit">;

// Reads go through the repository; with no network the mirror declines them, because the view's
// `spent` is derived money and that is O-F3. Writes stay plain API calls until the outbox (O-F4).
export function fetchBudgets(filters: BudgetFilters = {}): Promise<Budget[]> {
  return readBudgets(filters);
}

export function fetchBudgetsPage(filters: BudgetFilters = {}): Promise<BudgetList> {
  return api<BudgetList>("/budgets", {
    query: {
      reference: filters.reference,
      includeExpired: filters.includeExpired ? "true" : undefined,
      limit: 100,
    },
  });
}

export function createBudget(input: CreateBudgetInput): Promise<Budget> {
  return api<Budget>("/budgets", { method: "POST", body: input });
}

export function fetchBudget(id: string, reference?: string): Promise<Budget> {
  return readBudget(id, reference);
}

export function updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`, { method: "PUT", body: input });
}

export function archiveBudget(id: string): Promise<unknown> {
  return api<unknown>(`/budgets/${id}`, { method: "DELETE" });
}

export function restoreBudget(id: string, reference?: string): Promise<Budget> {
  return api<Budget>(`/budgets/${id}/restore`, { method: "POST", query: { reference } });
}

export function setBudgetOverride(id: string, reference: string, amount: number): Promise<Budget> {
  return api<Budget>(`/budgets/${id}/amount`, {
    method: "PUT",
    query: { reference },
    body: { amount } satisfies BudgetAmountOverrideInput,
  });
}

export function removeBudgetOverride(id: string, reference: string): Promise<Budget> {
  return api<Budget>(`/budgets/${id}/amount`, { method: "DELETE", query: { reference } });
}

export function fetchSpendingTotal(from: string, to: string): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { type: "EXPENSE", from, to } });
}
