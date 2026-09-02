import type { QueryClient } from "@tanstack/react-query";

// Root query keys per feature; every features/*/keys.ts derives its `all` from here so invalidations cannot drift.
export const QUERY_DOMAINS = {
  transactions: ["transactions"],
  accounts: ["accounts"],
  categories: ["categories"],
  budgets: ["budgets"],
  stats: ["stats"],
  home: ["home"],
} as const;

const MONEY_MOVEMENT_DOMAINS = [
  QUERY_DOMAINS.transactions,
  QUERY_DOMAINS.accounts,
  QUERY_DOMAINS.budgets,
  QUERY_DOMAINS.stats,
  QUERY_DOMAINS.home,
];

export async function invalidateMoneyMovement(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    MONEY_MOVEMENT_DOMAINS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
