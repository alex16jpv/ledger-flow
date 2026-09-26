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
import { byKey, idList, oneOf, sent, unsupported } from "./params";
import { mirrorNotFound, read } from "./read";
import { bounds } from "./stats";
import { dateCursorRange, mirrorTimeZone } from "./window";

export type TransactionQuery = Record<string, QueryValue>;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SOURCES = new Set<SyncTransaction["source"]>(["MANUAL", "QUICK", "IMPORT"]);
// The list answers for every kind there is, payments between people included; Stats does not.
const LIST_TYPES = new Set<SyncTransaction["type"]>([
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "ADJUSTMENT",
  "SETTLEMENT",
]);
const BOOLEANS = new Set(["true", "false"]);

// Anything outside this list would make the mirror answer a question it did not apply.
const SUPPORTED_PARAMS = new Set([
  "from",
  "to",
  "type",
  "accountId",
  "categoryId",
  "categoryIds",
  "uncategorized",
  "tag",
  "pendingDetails",
  "source",
  "sort",
  "order",
  "limit",
  "cursor",
  "includeSummary",
]);

type SortField = "date" | "amount";
type SortOrder = "asc" | "desc";

interface MirrorFilter {
  from?: string;
  to?: string;
  days?: DayWindow;
  sort: SortField;
  order: SortOrder;
  limit: number;
  cursor?: string;
  includeSummary: boolean;
  // F-15: with nothing to ask of each row the index knows the total and the walk can stop.
  filtered: boolean;
  matches: (record: TransactionRecord) => boolean;
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
  if (unsupported(query, SUPPORTED_PARAMS)) return undefined;
  const params = new Map(
    Object.entries(query)
      .filter(([, value]) => sent(value))
      .map(([key, value]) => [key, String(value)]),
  );

  // F-17: a bound with an offset sorts below every row of its own last day, so it is normalised.
  const window = bounds(params.get("from"), params.get("to"));
  if (window === null) return undefined;
  const { from, to } = window;

  // Every one of these the server answers with a 400, so the mirror declines rather than guesses.
  const type = oneOf<SyncTransaction["type"]>(params.get("type"), LIST_TYPES);
  const source = oneOf<SyncTransaction["source"]>(params.get("source"), SOURCES);
  const rawUncategorized = oneOf(params.get("uncategorized"), BOOLEANS);
  const rawPending = oneOf(params.get("pendingDetails"), BOOLEANS);
  if (type === null || source === null || rawUncategorized === null || rawPending === null) {
    return undefined;
  }
  const limit = params.has("limit") ? Number(params.get("limit")) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return undefined;

  const accountId = params.get("accountId");
  const uncategorized = isTrue(rawUncategorized);
  const categoryId = uncategorized ? undefined : params.get("categoryId");
  // The server refuses each of these pairs with a 400 rather than deciding which one wins.
  if (params.has("categoryIds") && (uncategorized || params.has("categoryId"))) return undefined;
  const ids = idList(params.get("categoryIds"));
  if (ids === null) return undefined;
  const categoryIds = ids && new Set(ids);
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") ?? "desc";
  // A sort the mirror does not know would answer a different question with the same rows.
  if (sort !== "date" && sort !== "amount") return undefined;
  if (order !== "asc" && order !== "desc") return undefined;
  const tag = params.get("tag");
  const pending = rawPending === undefined ? undefined : isTrue(rawPending);
  const predicates = [type, accountId, categoryId, categoryIds, tag, source, pending].filter(
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
    sort,
    order,
    limit,
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
      (categoryIds === undefined ||
        (record.categoryId !== undefined && categoryIds.has(record.categoryId))) &&
      (!uncategorized || record.categoryId === undefined) &&
      (tag === undefined || record.row.tags.includes(tag)) &&
      (source === undefined || record.row.source === source) &&
      (pending === undefined || record.row.pendingDetails === pending),
  };
}

type TransactionSummary = NonNullable<TransactionList["summary"]>;

// The endpoint's own sums, added in minor units the way lib/local/derive adds every figure.
function summarize(records: readonly TransactionRecord[]): TransactionSummary {
  const sumOf = (type: SyncTransaction["type"]) =>
    sumAmounts(
      records.filter((record) => record.row.type === type).map((record) => record.row.amount),
    );
  return { expense: sumOf("EXPENSE"), income: sumOf("INCOME") };
}

// The index is (date, id) descending, so any other order is read whole and sorted, never streamed.
function isDefaultOrder(filter: MirrorFilter): boolean {
  return filter.sort === "date" && filter.order === "desc";
}

function compareRows(a: TransactionRecord, b: TransactionRecord, sort: SortField): number {
  const by = sort === "amount" ? a.row.amount - b.row.amount : byKey(a.row.date, b.row.date);
  // The tie follows the direction, like the server's keyset over (field, _id).
  return by || byKey(a.row.id, b.row.id);
}

async function orderedMirror(
  db: IDBPDatabase<VaultSchema>,
  filter: MirrorFilter,
): Promise<TransactionList | undefined> {
  const matched: TransactionRecord[] = [];
  const index = db.transaction("transactions").store.index("dateCursor");
  const range = dateCursorRange(widenedBound(filter.from, -1), widenedBound(filter.to, 1));
  for await (const entry of index.iterate(range)) {
    if (filter.matches(entry.value)) matched.push(entry.value);
  }
  matched.sort((a, b) => (filter.order === "asc" ? 1 : -1) * compareRows(a, b, filter.sort));

  let start = 0;
  if (filter.cursor !== undefined) {
    // Like the server's keyset, the pivot is looked up by id, not found among the rows it filtered.
    const anchor = await db.get("transactions", filter.cursor);
    if (!anchor) return undefined;
    const direction = filter.order === "asc" ? 1 : -1;
    start = matched.findIndex((record) => direction * compareRows(record, anchor, filter.sort) > 0);
    if (start < 0) start = matched.length;
  }
  const page = matched.slice(start, start + filter.limit);
  const hasMore = start + page.length < matched.length;
  const pagination: Pagination = {
    limit: filter.limit,
    offset: 0,
    total: matched.length,
    hasMore,
    nextCursor: hasMore ? (page.at(-1)?.row.id ?? null) : null,
  };
  const data = page.map((record) => toApiRow(record.row));
  if (!filter.includeSummary) return { data, pagination };
  return { data, pagination, summary: summarize(matched) };
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
  const summed: TransactionRecord[] = [];
  let walked = 0;
  let past = false;
  let beyond = false;
  // Its own transaction: awaiting the pivot lookup first would let this one auto-commit mid-walk.
  const index = db.transaction("transactions").store.index("dateCursor");
  const range = dateCursorRange(widenedBound(filter.from, -1), widenedBound(filter.to, 1));
  // F-15: both requests go out before the first await, so they share this transaction.
  const counting = filter.filtered || filter.includeSummary ? undefined : index.count(range);
  for await (const entry of index.iterate(range, "prev")) {
    const record = entry.value;
    if (!filter.matches(record)) continue;
    walked += 1;
    if (filter.includeSummary) summed.push(record);
    if (pivot !== undefined && !past) {
      if (indexedDB.cmp(entry.key, pivot) >= 0) continue;
      past = true;
    }
    if (data.length < filter.limit) {
      data.push(toApiRow(record.row));
      continue;
    }
    beyond = true;
    if (counting !== undefined && !filter.includeSummary) break;
  }
  const total = (await counting) ?? walked;

  // The server asks for one row past the page and answers by whether it got it, cursor or not.
  const hasMore = filter.cursor !== undefined ? beyond : data.length < total;
  const pagination: Pagination = {
    limit: filter.limit,
    offset: 0,
    total,
    hasMore,
    nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
  };
  if (!filter.includeSummary) return { data, pagination };
  return { data, pagination, summary: summarize(summed) };
}

export function readTransactions(query: TransactionQuery): Promise<TransactionList> {
  return read<TransactionList>(
    () => api<TransactionList>("/transactions", { query }),
    async (db) => {
      // Only a windowed query needs the zone, so an unfiltered list answers without the profile.
      const filter = toMirrorFilter(query, hasWindow(query) ? await mirrorTimeZone(db) : undefined);
      if (!filter) return undefined;
      return isDefaultOrder(filter) ? queryMirror(db, filter) : orderedMirror(db, filter);
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
