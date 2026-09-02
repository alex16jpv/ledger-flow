import { api } from "@/lib/api/client";
import type {
  QuickAddTransactionInput,
  Transaction,
  TransactionList,
  UpdateTransactionInput,
} from "@/types/api";

export function fetchPendingCount(): Promise<TransactionList> {
  return api<TransactionList>("/transactions", { query: { pendingDetails: true, limit: 1 } });
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
