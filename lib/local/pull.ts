import { api } from "@/lib/api/client";
import type { SyncChangesResponse } from "@/types/api";

import type { VaultHandle } from "./db";
import { writeTransaction } from "./outbox/queue";
import { reconcileContext, reconcileRow } from "./outbox/reconcile";
import { PROFILE_KEY, profileRecord } from "./schema";

export const PULL_PAGE_LIMIT = 500;

export interface PullPageQuery {
  cursor?: string;
  limit: number;
}

export type PullPageFetcher = (query: PullPageQuery) => Promise<SyncChangesResponse>;

export interface PullOptions {
  limit?: number;
  fetchPage?: PullPageFetcher;
}

export interface PullResult {
  pages: number;
  rows: number;
  // Whether any of those rows said something the mirror did not already hold (F-38).
  changed: boolean;
  cursor: string;
  serverTime: string;
}

export class SyncFeedStalledError extends Error {
  readonly cursor: string;

  constructor(cursor: string) {
    super("The change feed asked for another page without moving its cursor");
    this.name = "SyncFeedStalledError";
    this.cursor = cursor;
  }
}

function requestPage(query: PullPageQuery): Promise<SyncChangesResponse> {
  return api<SyncChangesResponse>("/sync/changes", { query: { ...query } });
}

interface StampedStore {
  get: (id: string) => Promise<{ updatedAt: string } | undefined>;
}

// The feed overlaps 60 seconds on purpose (D-14), so a page carrying rows is not the same as a page
// carrying news: only a stamp the mirror has not seen is worth making the screens read again. The
// callers stop asking once one row is news, which is all the answer they need.
async function isNews(store: StampedStore, id: string, updatedAt: string): Promise<boolean> {
  return (await store.get(id))?.updatedAt !== updatedAt;
}

async function applyPage(handle: VaultHandle, page: SyncChangesResponse): Promise<boolean> {
  const { changes, pagination } = page;
  const tx = writeTransaction(handle.db);
  let news = false;
  if (changes.user) {
    news ||= await isNews(tx.objectStore("profile"), PROFILE_KEY, changes.user.updatedAt);
    await tx.objectStore("profile").put(profileRecord(changes.user));
  }
  // D-23 (F-25): the server's row lands, and what the queue still has to send is projected back on
  // top of it. Without this a movement deleted with no network comes back alive on the next pull.
  const context = await reconcileContext(tx);
  for (const row of changes.accounts) {
    news ||= await isNews(tx.objectStore("accounts"), row.id, row.updatedAt);
    await reconcileRow(tx, "account", row.id, row, context);
  }
  for (const row of changes.categories) {
    news ||= await isNews(tx.objectStore("categories"), row.id, row.updatedAt);
    await reconcileRow(tx, "category", row.id, row, context);
  }
  for (const row of changes.transactions) {
    news ||= await isNews(tx.objectStore("transactions"), row.id, row.updatedAt);
    await reconcileRow(tx, "transaction", row.id, row, context);
  }
  for (const row of changes.budgets) {
    news ||= await isNews(tx.objectStore("budgets"), row.id, row.updatedAt);
    await reconcileRow(tx, "budget", row.id, row, context);
  }

  const meta = tx.objectStore("meta");
  // Stored verbatim: the cursor is opaque, and the next run resumes from it whatever it encodes.
  await meta.put({ key: "syncCursor", value: pagination.nextCursor });
  // Only a drained feed marks the mirror readable; a half-applied snapshot must not answer reads.
  if (!pagination.hasMore) await meta.put({ key: "syncedAt", value: page.serverTime });
  await tx.done;
  return news;
}

export async function pullChanges(
  handle: VaultHandle,
  options: PullOptions = {},
): Promise<PullResult> {
  const { limit = PULL_PAGE_LIMIT, fetchPage = requestPage } = options;
  const stored = await handle.db.get("meta", "syncCursor");
  let cursor = typeof stored?.value === "string" ? stored.value : undefined;
  let pages = 0;
  let rows = 0;
  let changed = false;

  for (;;) {
    const page = await fetchPage({ cursor, limit });
    // Rows are applied by id with put, so the deliberate 60-second overlap of D-14 costs nothing.
    changed = (await applyPage(handle, page)) || changed;
    pages += 1;
    rows += page.pagination.count;

    const next = page.pagination.nextCursor;
    if (!page.pagination.hasMore) {
      return { pages, rows, changed, cursor: next, serverTime: page.serverTime };
    }
    if (next === cursor) throw new SyncFeedStalledError(next);
    cursor = next;
  }
}
