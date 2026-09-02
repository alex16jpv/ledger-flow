import { QUERY_DOMAINS } from "@/lib/query/domains";

export const budgetKeys = {
  all: QUERY_DOMAINS.budgets,
  list: (reference?: string) =>
    [...budgetKeys.all, "list", { reference: reference ?? null }] as const,
  detail: (id: string, reference?: string) =>
    [...budgetKeys.all, "detail", id, { reference: reference ?? null }] as const,
};
