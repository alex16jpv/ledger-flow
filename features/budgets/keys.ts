import { QUERY_DOMAINS } from "@/lib/query/domains";

import type { BudgetFilters, BudgetSpendingParams } from "./api";

export const budgetKeys = {
  all: QUERY_DOMAINS.budgets,
  list: (filters: BudgetFilters = {}) =>
    [
      ...budgetKeys.all,
      "list",
      {
        reference: filters.reference ?? null,
        includeExpired: filters.includeExpired ?? false,
        includeArchived: filters.includeArchived ?? false,
      },
    ] as const,
  lastMonthSpending: (from: string) => [...budgetKeys.all, "last-month-spending", from] as const,
  detail: (id: string, reference?: string) =>
    [...budgetKeys.all, "detail", id, { reference: reference ?? null }] as const,
  spending: (id: string, params: BudgetSpendingParams) =>
    [...budgetKeys.all, "spending", id, params] as const,
  history: (id: string, periodFrom: string, count: number) =>
    [...budgetKeys.all, "history", id, { periodFrom, count }] as const,
};
