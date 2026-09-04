import { api } from "@/lib/api/client";
import type { Account, AccountList } from "@/types/api";

import { mirrorPage, read } from "./read";

export const ACCOUNT_PAGE_LIMIT = 100;

export interface AccountListParams {
  includeArchived?: boolean;
  limit?: number;
}

export function readAccounts(params: AccountListParams = {}): Promise<AccountList> {
  const limit = params.limit ?? ACCOUNT_PAGE_LIMIT;
  return read<AccountList>(
    () =>
      api<AccountList>("/accounts", {
        query: { includeArchived: params.includeArchived ? "true" : undefined, limit },
      }),
    async (db) => {
      const records = await db.getAll("accounts");
      const rows = records
        .filter((record) => params.includeArchived === true || record.archived === 0)
        .map((record) => record.row);
      return mirrorPage(rows, limit);
    },
  );
}

// The API answers with the archived ones too, so the mirror does not filter here either.
export function readAccount(id: string): Promise<Account> {
  return read<Account>(
    () => api<Account>(`/accounts/${id}`),
    async (db) => (await db.get("accounts", id))?.row,
  );
}
