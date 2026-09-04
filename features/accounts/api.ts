import { api } from "@/lib/api/client";
import { type AccountListParams, readAccount, readAccounts } from "@/lib/local/repository";
import type {
  Account,
  AccountList,
  CreateAccountInput,
  RestoreInput,
  UpdateAccountInput,
} from "@/types/api";

// Reads go through the repository, which falls back to the offline mirror; writes are still the
// plain API call until the outbox lands (O-F4).
export function fetchAccounts(params: AccountListParams = {}): Promise<AccountList> {
  return readAccounts(params);
}

export function fetchAccount(id: string): Promise<Account> {
  return readAccount(id);
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

export function restoreAccount(id: string, input: RestoreInput = {}): Promise<Account> {
  return api<Account>(`/accounts/${id}/restore`, { method: "POST", body: input });
}

export function setDefaultAccount(id: string): Promise<Account> {
  return api<Account>(`/accounts/${id}/default`, { method: "POST" });
}
