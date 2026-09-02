import { QUERY_DOMAINS } from "@/lib/query/domains";

export const homeKeys = {
  all: QUERY_DOMAINS.home,
  spending: (from: string, to: string, type: string, groupBy?: string) =>
    [...homeKeys.all, "spending", { from, to, type, groupBy: groupBy ?? null }] as const,
  accounts: () => [...homeKeys.all, "accounts"] as const,
  budgets: (reference: string) => [...homeKeys.all, "budgets", { reference }] as const,
};
