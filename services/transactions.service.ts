import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Transaction } from "@/types/Transaction.types";
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
} from "@/lib/schemas/transaction.schema";
import { getCached, setCache, invalidateDomain, requestSignature } from "@/lib/cache";

const DOMAIN = "transactions" as const;

export async function getTransactions(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Transaction>>> {
  const sig = requestSignature("/api/transactions", params);
  const cached = getCached<ProxyResponse<PaginatedResult<Transaction>>>(DOMAIN, sig);
  if (cached) return cached;

  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/transactions${query}`);
  const data: ProxyResponse<PaginatedResult<Transaction>> = await res.json();
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
}

export async function getTransaction(
  id: string,
): Promise<ProxyResponse<Transaction>> {
  const sig = requestSignature(`/api/transactions/${id}`);
  const cached = getCached<ProxyResponse<Transaction>>(DOMAIN, sig);
  if (cached) return cached;

  const res = await fetch(`/api/transactions/${id}`);
  const data: ProxyResponse<Transaction> = await res.json();
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
}

export async function createTransaction(
  payload: CreateTransactionPayload,
): Promise<ProxyResponse<Transaction>> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: ProxyResponse<Transaction> = await res.json();
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
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
  const data: ProxyResponse<Transaction> = await res.json();
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}

export async function deleteTransaction(
  id: string,
): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "DELETE",
  });
  const data: ProxyResponse<null> = await res.json();
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}
