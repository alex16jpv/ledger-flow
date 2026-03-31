import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Transaction } from "@/types/Transaction.types";
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
} from "@/lib/schemas/transaction.schema";

export async function getTransactions(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Transaction>>> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/transactions${query}`);
  return res.json();
}

export async function getTransaction(
  id: string,
): Promise<ProxyResponse<Transaction>> {
  const res = await fetch(`/api/transactions/${id}`);
  return res.json();
}

export async function createTransaction(
  payload: CreateTransactionPayload,
): Promise<ProxyResponse<Transaction>> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionPayload,
): Promise<ProxyResponse<Transaction>> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteTransaction(
  id: string,
): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "DELETE",
  });
  return res.json();
}
