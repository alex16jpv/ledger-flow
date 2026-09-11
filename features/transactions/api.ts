import type { QueryValue } from "@/lib/api/query";
import {
  readSpending,
  readTransaction,
  readTransactions,
  readTransactionTags,
} from "@/lib/local/repository";
import type { StatsResponse, TagList, Transaction, TransactionList } from "@/types/api";

export const LIST_PAGE_SIZE = 30;

// O-F4: reads via the repository, writes via the outbox; a batch expands, one `If-Match` each.
export {
  batchUpdateTransactions,
  createTransaction,
  deleteTransaction,
  quickAddTransaction,
  updateTransaction,
} from "@/lib/local/outbox";

export function fetchTransactionsPage(
  query: Record<string, QueryValue>,
  cursor?: string,
): Promise<TransactionList> {
  return readTransactions({ ...query, limit: LIST_PAGE_SIZE, cursor });
}

export function fetchLatestTransactions(
  query: Record<string, QueryValue>,
  limit: number,
): Promise<TransactionList> {
  return readTransactions({ ...query, limit });
}

export function fetchTransactionsCount(
  query: Record<string, QueryValue>,
): Promise<TransactionList> {
  return readTransactions({ ...query, limit: 1 });
}

export interface DailyStatsParams {
  type: "EXPENSE" | "INCOME";
  from: string;
  to: string;
}

export function fetchDailyStats({ type, from, to }: DailyStatsParams): Promise<StatsResponse> {
  return readSpending({ groupBy: "day", type, from, to });
}

export function fetchPendingCount(): Promise<TransactionList> {
  return readTransactions({ pendingDetails: true, limit: 1, includeSummary: true });
}

export function fetchTransaction(id: string): Promise<Transaction> {
  return readTransaction(id);
}

export function fetchTags(): Promise<TagList> {
  return readTransactionTags();
}
