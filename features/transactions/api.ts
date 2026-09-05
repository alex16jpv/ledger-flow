import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import {
  readSpending,
  readTransaction,
  readTransactions,
  readTransactionTags,
} from "@/lib/local/repository";
import type {
  BatchUpdateResult,
  BatchUpdateTransactionsInput,
  StatsResponse,
  TagList,
  Transaction,
  TransactionList,
} from "@/types/api";

export const LIST_PAGE_SIZE = 30;

// Reads go through the repository, which falls back to the offline mirror; writes go through the
// outbox, which queues the operation with the row and answers from the projection (O-F4). The batch
// endpoint is the one write still going straight out: one header cannot guard N rows (F-20).
export {
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

export function batchUpdateTransactions(
  input: BatchUpdateTransactionsInput,
  idempotencyKey: string,
): Promise<BatchUpdateResult> {
  return api<BatchUpdateResult>("/transactions/batch", {
    method: "PATCH",
    body: input,
    idempotencyKey,
  });
}
