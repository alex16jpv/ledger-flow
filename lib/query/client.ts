import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError, NetworkError } from "@/lib/api/errors";

export const DEFAULT_STALE_TIME_MS = 30_000;
export const MAX_RETRY_DELAY_MS = 8_000;

export function retryDelayWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return base / 2 + Math.random() * (base / 2);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 429;
  return error instanceof NetworkError;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay: retryDelayWithJitter,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: 0 },
    },
  });
}
