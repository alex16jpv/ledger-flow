"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPendingCount } from "./api";
import { transactionKeys } from "./keys";

export function usePendingCount(enabled = true): number {
  const query = useQuery({
    queryKey: transactionKeys.pendingCount(),
    queryFn: fetchPendingCount,
    enabled,
    select: (list) => list.pagination.total,
  });
  return query.data ?? 0;
}
