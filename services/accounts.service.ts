import type { ProxyResponse, PaginatedResult } from "@/lib/api/proxy";
import type { Account } from "@/types/Account.types";
import type {
  CreateAccountFormFields,
  UpdateAccountFormFields,
} from "@/lib/schemas/account.schema";
import { getCached, setCache, clearDomainCache, requestSignature } from "@/lib/cache";

const DOMAIN = "accounts" as const;

export async function getAccounts(
  params?: Record<string, string>,
): Promise<ProxyResponse<PaginatedResult<Account>>> {
  const sig = requestSignature("/api/accounts", params);
  const cached = getCached<ProxyResponse<PaginatedResult<Account>>>(DOMAIN, sig);
  if (cached) return cached;

  const query = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`/api/accounts${query}`);
  const data: ProxyResponse<PaginatedResult<Account>> = await res.json();
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

  const res = await fetch(`/api/accounts/${id}`);
  const data: ProxyResponse<Account> = await res.json();
  if (!data.error) setCache(DOMAIN, sig, data);
  return data;
}

export async function createAccount(
  payload: CreateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const res = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: ProxyResponse<Account> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
}

export async function updateAccount(
  id: string,
  payload: UpdateAccountFormFields,
): Promise<ProxyResponse<Account>> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: ProxyResponse<Account> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
}

export async function deleteAccount(id: string): Promise<ProxyResponse<null>> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: "DELETE",
  });
  const data: ProxyResponse<null> = await res.json();
  if (!data.error) clearDomainCache(DOMAIN);
  return data;
}
