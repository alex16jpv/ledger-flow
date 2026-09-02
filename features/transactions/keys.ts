import { QUERY_DOMAINS } from "@/lib/query/domains";

export const transactionKeys = {
  all: QUERY_DOMAINS.transactions,
  pendingCount: () => [...transactionKeys.all, "pending-count"] as const,
};
