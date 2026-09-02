import { QUERY_DOMAINS } from "@/lib/query/domains";

import type { BudgetFilters } from "./api";

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
  detail: (id: string, reference?: string) =>
    [...budgetKeys.all, "detail", id, { reference: reference ?? null }] as const,
};
