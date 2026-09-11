import type { QueryClient } from "@tanstack/react-query";

// Root query keys per feature; every features/*/keys.ts derives its `all` from here so invalidations cannot drift.
export const QUERY_DOMAINS = {
  transactions: ["transactions"],
  accounts: ["accounts"],
  categories: ["categories"],
  budgets: ["budgets"],
  stats: ["stats"],
  home: ["home"],
  // The mirror's copy of the user (F-63); the session itself is `sessionKeys`, and stays a server read.
  profile: ["profile"],
} as const;

// O-F2a: the prefix covers a whole domain, so it is listed only once all its reads are local.
export const MIRROR_BACKED_DOMAINS = [
  QUERY_DOMAINS.accounts,
  QUERY_DOMAINS.categories,
  QUERY_DOMAINS.transactions,
  QUERY_DOMAINS.budgets,
  QUERY_DOMAINS.home,
  QUERY_DOMAINS.stats,
  QUERY_DOMAINS.profile,
];

// F-38: every mirror-backed domain is re-read; a map of entity to domain would drift.
export async function invalidateMirrorBacked(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    MIRROR_BACKED_DOMAINS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

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
