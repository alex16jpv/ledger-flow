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
  QUERY_DOMAINS.profile,
];

// F-38: a pull that brought news wrote straight into the mirror, and React Query has no idea. Every
// mirror-backed domain is re-read rather than the ones whose store changed: a stale screen fails in
// silence, and mapping an entity to the domains that show it is a map that drifts the first time a
// screen joins one more. Re-reading is IndexedDB, not the network.
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
