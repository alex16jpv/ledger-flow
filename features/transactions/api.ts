import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import type {
  CreateTransactionInput,
  QuickAddTransactionInput,
  StatsResponse,
  TagList,
  Transaction,
  TransactionList,
  UpdateTransactionInput,
} from "@/types/api";

export const LIST_PAGE_SIZE = 30;

export function fetchTransactionsPage(
  query: Record<string, QueryValue>,
  cursor?: string,
): Promise<TransactionList> {
  return api<TransactionList>("/transactions", {
    query: { ...query, limit: LIST_PAGE_SIZE, cursor },
  });
}

export function fetchTransactionsCount(
  query: Record<string, QueryValue>,
): Promise<TransactionList> {
  return api<TransactionList>("/transactions", { query: { ...query, limit: 1 } });
}

export interface DailyStatsParams {
  type: "EXPENSE" | "INCOME";
  from: string;
  to: string;
}

export function fetchDailyStats({ type, from, to }: DailyStatsParams): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { groupBy: "day", type, from, to } });
}

export function fetchPendingCount(): Promise<TransactionList> {
  return api<TransactionList>("/transactions", {
    query: { pendingDetails: true, limit: 1, includeSummary: true },
  });
}

export function fetchTransaction(id: string): Promise<Transaction> {
  return api<Transaction>(`/transactions/${id}`);
}

export function fetchTags(): Promise<TagList> {
  return api<TagList>("/transactions/tags");
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

export function deleteTransaction(id: string): Promise<unknown> {
  return api<unknown>(`/transactions/${id}`, { method: "DELETE" });
}
