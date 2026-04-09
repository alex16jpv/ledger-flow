import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Account } from "@/types/Account.types";
import type {
  CreateAccountFormFields,
  UpdateAccountFormFields,
} from "@/lib/schemas/account.schema";
import { getCached, setCache, invalidateDomain, requestSignature } from "@/lib/cache";
import { safeFetch } from "@/lib/api/safeFetch";

const DOMAIN = "accounts" as const;

export async function getAccounts(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Account>>> {
  const sig = requestSignature("/api/accounts", params);
  const cached = getCached<ProxyResponse<PaginatedResult<Account>>>(DOMAIN, sig);
  if (cached) return cached;

  const query = params ? `?${new URLSearchParams(params)}` : "";
  const data = await safeFetch<PaginatedResult<Account>>(`/api/accounts${query}`);
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
}

export async function getAccountsByIds(
  ids: string[],
): Promise<ProxyResponse<PaginatedResult<Account>>> {
  if (ids.length === 0) {
    return {
      data: { data: [], pagination: { limit: 0, offset: 0, total: 0, hasMore: false, nextCursor: null } },
      status: 200,
      error: null,
    };
  }
  return getAccounts({ ids: ids.join(",") });
}

export async function getAccount(id: string): Promise<ProxyResponse<Account>> {
  const sig = requestSignature(`/api/accounts/${id}`);
  const cached = getCached<ProxyResponse<Account>>(DOMAIN, sig);
  if (cached) return cached;

  const data = await safeFetch<Account>(`/api/accounts/${id}`);
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
}

export async function createAccount(
  payload: CreateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const data = await safeFetch<Account>("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}

export async function updateAccount(
  id: string,
  payload: UpdateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const data = await safeFetch<Account>(`/api/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}

export async function deleteAccount(id: string): Promise<ProxyResponse<null>> {
  const data = await safeFetch<null>(`/api/accounts/${id}`, {
    method: "DELETE",
  });
  if (!data.error) invalidateDomain(DOMAIN);
  return data;
}
