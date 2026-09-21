import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError, NetworkError } from "@/lib/api/errors";
import { connectivityStore } from "@/lib/network/connectivity";

export const DEFAULT_STALE_TIME_MS = 30_000;
// Reference data changes only through our own mutations, which invalidate it: a long staleTime saves round trips.
export const REFERENCE_STALE_TIME_MS = 5 * 60 * 1000;
export const MAX_RETRY_DELAY_MS = 8_000;

export function retryDelayWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return base / 2 + Math.random() * (base / 2);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  // A retry nobody can grant is a failure the screen waits for instead of showing.
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
        // H-17: pausing a read leaves the screen waiting for ever; every read fails out loud instead.
        networkMode: "always",
        // React Query derives this from `networkMode`, and "always" would turn it off.
        refetchOnReconnect: true,
      },
      // A paused mutation never runs its mutationFn, so the outbox of O-F4 was never reached.
      mutations: { retry: 0, networkMode: "offlineFirst" },
    },
  });
  return client;
}
