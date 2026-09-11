import { api } from "@/lib/api/client";
import type { Account, AccountList } from "@/types/api";

import { projectBalances } from "../outbox/projection";
import { pendingOperations, type VaultDb } from "../outbox/queue";
import { willBeSent } from "../outbox/reproject";
import { mirrorPage, read } from "./read";

export const ACCOUNT_PAGE_LIMIT = 100;

export interface AccountListParams {
  includeArchived?: boolean;
  limit?: number;
}

// Invariant 2 with D-23: the server's `balance` plus the effect of what it has not applied yet.
async function withProjectedBalances(db: VaultDb, rows: Account[]): Promise<Account[]> {
  const operations = (await pendingOperations(db)).filter(willBeSent);
  if (operations.length === 0) return rows;
  const projected = new Map(
    projectBalances(rows, operations).map((entry) => [entry.accountId, entry.balance]),
  );
  return rows.map((row) => ({ ...row, balance: projected.get(row.id) ?? row.balance }));
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
      return mirrorPage(await withProjectedBalances(db, rows), limit);
    },
  );
}

// The API answers with the archived ones too, so the mirror does not filter here either.
export function readAccount(id: string): Promise<Account> {
  return read<Account>(
    () => api<Account>(`/accounts/${id}`),
    async (db) => {
      const record = await db.get("accounts", id);
      return record && (await withProjectedBalances(db, [record.row]))[0];
    },
  );
}
