import { api } from "@/lib/api/client";
import type { Account, AccountList, CreateAccountInput } from "@/types/api";

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

export function createAccount(input: CreateAccountInput): Promise<Account> {
  return api<Account>("/accounts", { method: "POST", body: input });
}
