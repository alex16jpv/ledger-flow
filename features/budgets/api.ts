import { api } from "@/lib/api/client";
import type {
  Budget,
  BudgetAmountOverrideInput,
  BudgetList,
  CreateBudgetInput,
  StatsResponse,
  UpdateBudgetInput,
} from "@/types/api";

export interface BudgetFilters {
  reference?: string;
  includeExpired?: boolean;
  includeArchived?: boolean;
}

// The expired/lifetime filters run after pagination on the server, so hasMore must be followed even for short pages.
export async function fetchBudgets(filters: BudgetFilters = {}): Promise<Budget[]> {
  const data: Budget[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<BudgetList>("/budgets", {
      query: {
        reference: filters.reference,
        includeExpired: filters.includeExpired ? "true" : undefined,
        includeArchived: filters.includeArchived ? "true" : undefined,
        limit: 100,
        cursor,
      },
    });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
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
  return api<Budget>(`/budgets/${id}`, { query: { reference } });
}

export function updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`, { method: "PUT", body: input });
}

export function archiveBudget(id: string): Promise<unknown> {
  return api<unknown>(`/budgets/${id}`, { method: "DELETE" });
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
