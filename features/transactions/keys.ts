import { QUERY_DOMAINS } from "@/lib/query/domains";

export const transactionKeys = {
  all: QUERY_DOMAINS.transactions,
  pendingCount: () => [...transactionKeys.all, "pending-count"] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  tags: () => [...transactionKeys.all, "tags"] as const,
  list: (query: Record<string, unknown>) => [...transactionKeys.all, "list", query] as const,
  count: (query: Record<string, unknown>) => [...transactionKeys.all, "count", query] as const,
  daily: (params: Record<string, unknown>) => [...transactionKeys.all, "daily", params] as const,
};
