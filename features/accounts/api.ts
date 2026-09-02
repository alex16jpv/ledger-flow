import { api } from "@/lib/api/client";
import type { Account, AccountList, CreateAccountInput, UpdateAccountInput } from "@/types/api";

export function fetchAccounts(
  params: { includeArchived?: boolean; limit?: number } = {},
): Promise<AccountList> {
  return api<AccountList>("/accounts", {
    query: {
      includeArchived: params.includeArchived ? "true" : undefined,
      limit: params.limit ?? 100,
    },
  });
}

export function fetchAccount(id: string): Promise<Account> {
  return api<Account>(`/accounts/${id}`);
}

export function createAccount(input: CreateAccountInput): Promise<Account> {
  return api<Account>("/accounts", { method: "POST", body: input });
}

export function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  return api<Account>(`/accounts/${id}`, { method: "PUT", body: input });
}

export function archiveAccount(id: string): Promise<unknown> {
  return api<unknown>(`/accounts/${id}`, { method: "DELETE" });
}

export function restoreAccount(id: string): Promise<Account> {
  return api<Account>(`/accounts/${id}/restore`, { method: "POST" });
}

export function setDefaultAccount(id: string): Promise<Account> {
  return api<Account>(`/accounts/${id}/default`, { method: "POST" });
}
