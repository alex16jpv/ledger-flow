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

import { type DayWindow, dayWindow, sumAmounts, widenedBound, withinDays } from "../derive";
import type { TransactionRecord, VaultSchema } from "../schema";
import { mirrorNotFound, read } from "./read";
import { dateCursorRange, mirrorTimeZone, storedStamp } from "./window";

export type TransactionQuery = Record<string, QueryValue>;

// Mirrors extractPagination on the server: an unusable limit becomes the default, never an error.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Anything outside this list would make the mirror answer a question it did not apply.
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
  days?: DayWindow;
  limit: number;
  cursor?: string;
  includeSummary: boolean;
  // F-15: with nothing to ask of each row the index knows the total and the walk can stop.
  filtered: boolean;
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
export function toApiRow(row: SyncTransaction): Transaction {
  const transaction: Transaction & { deletedAt?: string | null } = { ...row };
  delete transaction.deletedAt;
  return transaction;
}

function toMirrorFilter(
  query: TransactionQuery,
  timeZone: string | undefined,
): MirrorFilter | undefined {
  const entries = Object.entries(query).filter(([, value]) => sent(value));
  if (entries.some(([key]) => !SUPPORTED_PARAMS.has(key))) return undefined;
  const params = new Map(entries.map(([key, value]) => [key, String(value)]));

  // F-17: a bound with an offset sorts below every row of its own last day, so it is normalised.
  const bound = (raw?: string) => (raw === undefined ? undefined : storedStamp(raw));
  const from = bound(params.get("from"));
  const to = bound(params.get("to"));
  // Not a date at all: the server answers that with a 400, and so should the mirror by not taking it.
  if (from === null || to === null) return undefined;
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
  const predicates = [type, accountId, categoryId, tag, source, pending].filter(
    (value) => value !== undefined,
  );

  // Without the profile there is no zone to cut the days on, and the mirror declines.
  const windowed = from !== undefined || to !== undefined;
  if (windowed && timeZone === undefined) return undefined;
  const days = windowed && timeZone !== undefined ? dayWindow(from, to, timeZone) : undefined;

  return {
    from,
    to,
    days,
    limit: Math.min(Math.max(rawLimit || DEFAULT_LIMIT, 1), MAX_LIMIT),
    cursor: params.get("cursor"),
    includeSummary: isTrue(params.get("includeSummary")),
    filtered: uncategorized || predicates.length > 0 || days !== undefined,
    matches: (record) =>
      (days === undefined || withinDays(record.row, days)) &&
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

async function queryMirror(
  db: IDBPDatabase<VaultSchema>,
  filter: MirrorFilter,
): Promise<TransactionList | undefined> {
  let pivot: [string, string] | undefined;
  if (filter.cursor !== undefined) {
    // Keyset over (date, id) like the server, and a tombstone still carries the pivot's date.
    const anchor = await db.get("transactions", filter.cursor);
    if (!anchor) return undefined;
    pivot = [anchor.date, anchor.id];
  }

  const data: Transaction[] = [];
  const summed: number[] = [];
  let walked = 0;
  let past = false;
  // Its own transaction: awaiting the pivot lookup first would let this one auto-commit mid-walk.
  const index = db.transaction("transactions").store.index("dateCursor");
  const range = dateCursorRange(widenedBound(filter.from, -1), widenedBound(filter.to, 1));
  // F-15: both requests go out before the first await, so they share this transaction.
  const counting = filter.filtered || filter.includeSummary ? undefined : index.count(range);
  for await (const entry of index.iterate(range, "prev")) {
    const record = entry.value;
    if (!filter.matches(record)) continue;
    walked += 1;
    if (filter.includeSummary) summed.push(record.row.amount);
    if (pivot !== undefined && !past) {
      if (indexedDB.cmp(entry.key, pivot) >= 0) continue;
      past = true;
    }
    if (data.length < filter.limit) data.push(toApiRow(record.row));
    if (counting !== undefined && data.length === filter.limit) break;
  }
  const total = (await counting) ?? walked;

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
  return read<TransactionList>(
    () => api<TransactionList>("/transactions", { query }),
    async (db) => {
      // Only a windowed query needs the zone, so an unfiltered list answers without the profile.
      const filter = toMirrorFilter(query, hasWindow(query) ? await mirrorTimeZone(db) : undefined);
      return filter ? queryMirror(db, filter) : undefined;
    },
  );
}

const hasWindow = (query: TransactionQuery): boolean => sent(query.from) || sent(query.to);

export function readTransaction(id: string): Promise<Transaction> {
  return read<Transaction>(
    () => api<Transaction>(`/transactions/${id}`),
    async (db) => {
      const record = await db.get("transactions", id);
      // A deleted transaction is a 404 everywhere but the sync feed, and the tombstone says so.
      if (record?.deleted === 1) throw mirrorNotFound("transaction", id);
      return record ? toApiRow(record.row) : undefined;
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
