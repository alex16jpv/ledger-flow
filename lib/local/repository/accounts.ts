import { api } from "@/lib/api/client";
import type { Account, AccountList } from "@/types/api";

import { landedCents, landedFrom } from "../outbox/landed";
import { projectBalances } from "../outbox/projection";
import type { VaultDb } from "../outbox/queue";
import { willBeSent } from "../outbox/reproject";
import type { AccountRecord } from "../schema";
import { mirrorPage, read } from "./read";

export const ACCOUNT_PAGE_LIMIT = 100;

export interface AccountListParams {
  includeArchived?: boolean;
  limit?: number;
}

// Invariant 2 with D-23: the server's `balance` plus what it has not applied, or has and no pull brought.
async function projectedRecords(db: VaultDb, id?: string): Promise<AccountRecord[]> {
  // One transaction: a settle between two reads would count a write both queued and landed.
  const tx = db.transaction(["accounts", "outbox", "meta"]);
  const accounts = tx.objectStore("accounts");
  const [found, queue, landed] = await Promise.all([
    id === undefined ? accounts.getAll() : accounts.get(id).then((record) => [record]),
    tx.objectStore("outbox").getAll(),
    landedFrom(tx.objectStore("meta")),
  ]);
  const records = found.filter((record) => record !== undefined);
  const operations = queue.filter(willBeSent);
  if (operations.length === 0 && landed.length === 0) return records;
  const projected = new Map(
    projectBalances(
      records.map((record) => record.row),
      operations,
      landedCents(landed),
    ).map((entry) => [entry.accountId, entry.balance]),
  );
  return records.map((record) => ({
    ...record,
    row: { ...record.row, balance: projected.get(record.id) ?? record.row.balance },
  }));
}

export function readAccounts(params: AccountListParams = {}): Promise<AccountList> {
  const limit = params.limit ?? ACCOUNT_PAGE_LIMIT;
  return read<AccountList>(
    () =>
      api<AccountList>("/accounts", {
        query: { includeArchived: params.includeArchived ? "true" : undefined, limit },
      }),
    async (db) => {
      const rows = (await projectedRecords(db))
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
    async (db) => (await projectedRecords(db, id))[0]?.row,
  );
}
