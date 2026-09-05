import { api } from "@/lib/api/client";
import {
  type BudgetListParams,
  readBudget,
  readBudgets,
  readSpending,
} from "@/lib/local/repository";
import type {
  Budget,
  BudgetAmountOverrideInput,
  CreateBudgetInput,
  StatsResponse,
  UpdateBudgetInput,
} from "@/types/api";

export type BudgetFilters = Omit<BudgetListParams, "limit">;

// Reads go through the repository, which answers from the mirror while offline; writes stay plain
// API calls until the outbox lands (O-F4).
export function fetchBudgets(filters: BudgetFilters = {}): Promise<Budget[]> {
  return readBudgets(filters);
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
  return readSpending({ type: "EXPENSE", from, to });
}
