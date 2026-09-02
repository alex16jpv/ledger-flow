import { api } from "@/lib/api/client";
import type { Budget, BudgetList, CreateBudgetInput } from "@/types/api";

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
