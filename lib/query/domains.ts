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

// Reads these can answer from the offline mirror, so their fetch must run instead of being paused
// while offline (O-F2a). The prefix covers every key of a domain, so a domain is only listed once
// all its reads answer locally: budgets, home and stats joined when O-F3 part 2 derived `spent` and
// the spending buckets, which were the last server-only reads any of them had.
export const MIRROR_BACKED_DOMAINS = [
  QUERY_DOMAINS.accounts,
  QUERY_DOMAINS.categories,
  QUERY_DOMAINS.transactions,
  QUERY_DOMAINS.budgets,
  QUERY_DOMAINS.home,
  QUERY_DOMAINS.stats,
];

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
