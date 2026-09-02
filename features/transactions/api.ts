import { api } from "@/lib/api/client";
import type { TransactionList } from "@/types/api";

export function fetchPendingCount(): Promise<TransactionList> {
  return api<TransactionList>("/transactions", { query: { pendingDetails: true, limit: 1 } });
}
