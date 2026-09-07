import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore } from "@/lib/network/connectivity";

import { MIRROR_BACKED_DOMAINS } from "./domains";

export const DEFAULT_STALE_TIME_MS = 30_000;
export const MAX_RETRY_DELAY_MS = 8_000;

export function retryDelayWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return base / 2 + Math.random() * (base / 2);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  // `offlineFirst` runs the first attempt and then pauses the retry until the network is back, so
  // an invalidation awaiting it never resolves and the write that asked for it spins forever.
  if (connectivityStore.getSnapshot() === "offline") return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 429;
  return error instanceof NetworkError;
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay: retryDelayWithJitter,
        refetchOnWindowFocus: true,
      },
      // A paused mutation never runs its mutationFn, so with no network the outbox of O-F4 was
      // never reached and the form spun forever: `write()` is what chooses the queue or the wire.
      mutations: { retry: 0, networkMode: "offlineFirst" },
    },
  });
  for (const queryKey of MIRROR_BACKED_DOMAINS) {
    client.setQueryDefaults(queryKey, { networkMode: "offlineFirst" });
  }
  return client;
}
