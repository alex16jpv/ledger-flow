import type { IDBPDatabase } from "idb";

import { api } from "@/lib/api/client";
import type { QueryValue } from "@/lib/api/query";
import type {
  Pagination,
  SyncTransaction,
  TagList,
  Transaction,
  TransactionList,
} from "@/types/api";

import { sumAmounts } from "../derive";
import type { TransactionRecord, VaultSchema } from "../schema";
import { read } from "./read";

export type TransactionQuery = Record<string, QueryValue>;

// Mirrors extractPagination on the server: an unusable limit becomes the default, never an error.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Anything outside this list would make the mirror answer a question it did not apply, so it
// declines instead and the read goes to the server.
const SUPPORTED_PARAMS = new Set([
  "from",
  "to",
  "type",
  "accountId",
  "categoryId",
  "uncategorized",
  "tag",
  "pendingDetails",
  "source",
  "limit",
  "cursor",
  "includeSummary",
]);

interface MirrorFilter {
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
  includeSummary: boolean;
  matches: (record: TransactionRecord) => boolean;
}

// toQueryString skips these, so a parameter carrying one never reached the server either.
function sent(value: QueryValue): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isTrue(value: QueryValue): boolean {
  return String(value) === "true";
}

// deletedAt exists only on the sync feed; everywhere else a deleted transaction stops existing.
function toApiRow(row: SyncTransaction): Transaction {
  const transaction: Transaction & { deletedAt?: string | null } = { ...row };
  delete transaction.deletedAt;
  return transaction;
}

function toMirrorFilter(query: TransactionQuery): MirrorFilter | undefined {
  const entries = Object.entries(query).filter(([, value]) => sent(value));
  if (entries.some(([key]) => !SUPPORTED_PARAMS.has(key))) return undefined;
  const params = new Map(entries.map(([key, value]) => [key, String(value)]));

  const from = params.get("from");
  const to = params.get("to");
  // IDBKeyRange.bound throws on an inverted window; the server just matches nothing.
  if (from !== undefined && to !== undefined && from > to) return undefined;

  const type = params.get("type");
  const accountId = params.get("accountId");
  const uncategorized = isTrue(params.get("uncategorized"));
  const categoryId = uncategorized ? undefined : params.get("categoryId");
  const tag = params.get("tag");
  const source = params.get("source");
  const pending = params.has("pendingDetails") ? isTrue(params.get("pendingDetails")) : undefined;
  const rawLimit = Number(params.get("limit"));

  return {
    from,
    to,
    limit: Math.min(Math.max(rawLimit || DEFAULT_LIMIT, 1), MAX_LIMIT),
    cursor: params.get("cursor"),
    includeSummary: isTrue(params.get("includeSummary")),
    matches: (record) =>
      (type === undefined || record.row.type === type) &&
      (accountId === undefined ||
        record.fromAccountId === accountId ||
        record.toAccountId === accountId) &&
      (categoryId === undefined || record.categoryId === categoryId) &&
      (!uncategorized || record.categoryId === undefined) &&
      (tag === undefined || record.row.tags.includes(tag)) &&
      (source === undefined || record.row.source === source) &&
      (pending === undefined || record.row.pendingDetails === pending),
  };
}

// Comparing the dates as strings is comparing them as instants: they are the ISO stamps the server
// printed. An array key [d, id] sorts after [d], so an open bound on [to] is the server's `$lt`.
function windowRange(filter: MirrorFilter): IDBKeyRange | null {
  if (filter.from !== undefined && filter.to !== undefined) {
    return IDBKeyRange.bound([filter.from], [filter.to], false, true);
  }
  if (filter.from !== undefined) return IDBKeyRange.lowerBound([filter.from]);
  if (filter.to !== undefined) return IDBKeyRange.upperBound([filter.to], true);
  return null;
}

async function queryMirror(
  db: IDBPDatabase<VaultSchema>,
  filter: MirrorFilter,
): Promise<TransactionList | undefined> {
  let pivot: [string, string] | undefined;
  if (filter.cursor !== undefined) {
    // Keyset over (date, id) like the server: the pivot's own date comes from the row it names, and
    // a tombstone still carries it, so deleting the last row of a page does not restart the list.
    const anchor = await db.get("transactions", filter.cursor);
    if (!anchor) return undefined;
    pivot = [anchor.date, anchor.id];
  }

  const data: Transaction[] = [];
  const summed: number[] = [];
  let total = 0;
  let past = false;
  // Its own transaction: awaiting the pivot lookup first would let this one auto-commit mid-walk.
  const index = db.transaction("transactions").store.index("dateCursor");
  for await (const entry of index.iterate(windowRange(filter), "prev")) {
    const record = entry.value;
    if (!filter.matches(record)) continue;
    total += 1;
    if (filter.includeSummary) summed.push(record.row.amount);
    if (pivot !== undefined && !past) {
      if (indexedDB.cmp(entry.key, pivot) >= 0) continue;
      past = true;
    }
    if (data.length < filter.limit) data.push(toApiRow(record.row));
  }

  const hasMore = filter.cursor !== undefined ? data.length === filter.limit : data.length < total;
  const pagination: Pagination = {
    limit: filter.limit,
    offset: 0,
    total,
    hasMore,
    nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
  };
  if (!filter.includeSummary) return { data, pagination };
  // The endpoint's own sum, added in minor units the way lib/local/derive adds every figure.
  return { data, pagination, summary: { totalAmount: sumAmounts(summed) } };
}

export function readTransactions(query: TransactionQuery): Promise<TransactionList> {
  const filter = toMirrorFilter(query);
  return read<TransactionList>(
    () => api<TransactionList>("/transactions", { query }),
    filter ? (db) => queryMirror(db, filter) : () => Promise.resolve(undefined),
  );
}

export function readTransaction(id: string): Promise<Transaction> {
  return read<Transaction>(
    () => api<Transaction>(`/transactions/${id}`),
    async (db) => {
      const record = await db.get("transactions", id);
      // A deleted transaction is a 404 everywhere but the sync feed, and only the server can say so.
      return record?.deleted === 0 ? toApiRow(record.row) : undefined;
    },
  );
}

export function readTransactionTags(): Promise<TagList> {
  return read<TagList>(
    () => api<TagList>("/transactions/tags"),
    async (db) => {
      const tags = new Set<string>();
      for (const record of await db.getAll("transactions")) {
        if (record.deleted === 0) for (const tag of record.row.tags) tags.add(tag);
      }
      return { data: [...tags].sort() };
    },
  );
}
