import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import { readTransaction, readTransactions, readTransactionTags } from "@/lib/local/repository";
import type {
  BatchUpdateResult,
  BatchUpdateTransactionsInput,
  CreateTransactionInput,
  QuickAddTransactionInput,
  StatsResponse,
  TagList,
  Transaction,
  TransactionList,
  UpdateTransactionInput,
} from "@/types/api";

export const LIST_PAGE_SIZE = 30;

// Reads go through the repository, which falls back to the offline mirror; writes are still the
// plain API call until the outbox lands (O-F4).
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

// Still the server: day buckets are money derived over a time zone, which is O-F3, so with no
// network the period summary has no figures rather than made-up ones.
export function fetchDailyStats({ type, from, to }: DailyStatsParams): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { groupBy: "day", type, from, to } });
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

export function createTransaction(
  input: CreateTransactionInput,
  idempotencyKey: string,
): Promise<Transaction> {
  return api<Transaction>("/transactions", { method: "POST", body: input, idempotencyKey });
}

export function quickAddTransaction(
  input: QuickAddTransactionInput,
  idempotencyKey: string,
): Promise<Transaction> {
  return api<Transaction>("/transactions/quick", { method: "POST", body: input, idempotencyKey });
}

export function updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
  return api<Transaction>(`/transactions/${id}`, { method: "PUT", body: input });
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

export function deleteTransaction(id: string): Promise<unknown> {
  return api<unknown>(`/transactions/${id}`, { method: "DELETE" });
}
