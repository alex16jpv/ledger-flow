import { api } from "@/lib/api/client";
import type { Account, AccountList } from "@/types/api";

import { landedCents, landedFrom } from "../outbox/landed";
import { projectBalances } from "../outbox/projection";
import type { VaultDb } from "../outbox/queue";
import { willBeSent } from "../outbox/reproject";
import type { AccountRecord } from "../schema";
import { drainPages, mirrorPage, read } from "./read";

export const ACCOUNT_PAGE_LIMIT = 100;

export interface AccountListParams {
  includeArchived?: boolean;
  limit?: number;
}

function listQuery(params: AccountListParams) {
  return {
    includeArchived: params.includeArchived ? "true" : undefined,
    limit: params.limit ?? ACCOUNT_PAGE_LIMIT,
  };
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

function matching(records: AccountRecord[], params: AccountListParams): Account[] {
  return records
    .filter((record) => params.includeArchived === true || record.archived === 0)
    .map((record) => record.row);
}

export function readAccounts(params: AccountListParams = {}): Promise<Account[]> {
  return read<Account[]>(
    () => drainPages<Account>("/accounts", listQuery(params)),
    async (db) => matching(await projectedRecords(db), params),
  );
}

export function readAccountsPage(params: AccountListParams = {}): Promise<AccountList> {
  return read<AccountList>(
    () => api<AccountList>("/accounts", { query: listQuery(params) }),
    async (db) =>
      mirrorPage(matching(await projectedRecords(db), params), params.limit ?? ACCOUNT_PAGE_LIMIT),
  );
}

// The API answers with the archived ones too, so the mirror does not filter here either.
export function readAccount(id: string): Promise<Account> {
  return read<Account>(
    () => api<Account>(`/accounts/${id}`),
    async (db) => (await projectedRecords(db, id))[0]?.row,
  );
}
