import { api } from "@/lib/api/client";
import type { SyncChangesResponse } from "@/types/api";

import type { VaultHandle } from "./db";
import { type QueuedMirror, queuedMirror, reproject } from "./outbox/reproject";
import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  MIRROR_STORES,
  PROFILE_KEY,
  profileRecord,
  transactionRecord,
} from "./schema";

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

async function applyPage(handle: VaultHandle, page: SyncChangesResponse): Promise<void> {
  const { changes, pagination } = page;
  const tx = handle.db.transaction([...MIRROR_STORES, "outbox", "meta"], "readwrite");
  if (changes.user) await tx.objectStore("profile").put(profileRecord(changes.user));
  // D-23 (F-25): the server's row lands, and what the queue still has to send is projected back on
  // top of it. Without this a movement deleted with no network comes back alive on the next pull.
  const timezone =
    changes.user?.timezone ??
    (await tx.objectStore("profile").get(PROFILE_KEY))?.row.timezone ??
    null;
  const queued: QueuedMirror = queuedMirror(await tx.objectStore("outbox").getAll(), timezone);

  for (const row of changes.accounts) {
    await tx.objectStore("accounts").put(accountRecord(reproject("account", row, queued)));
  }
  for (const row of changes.categories) {
    await tx.objectStore("categories").put(categoryRecord(reproject("category", row, queued)));
  }
  for (const row of changes.transactions) {
    await tx
      .objectStore("transactions")
      .put(transactionRecord(reproject("transaction", row, queued)));
  }
  for (const row of changes.budgets) {
    await tx.objectStore("budgets").put(budgetRecord(reproject("budget", row, queued)));
  }

  const meta = tx.objectStore("meta");
  // Stored verbatim: the cursor is opaque, and the next run resumes from it whatever it encodes.
  await meta.put({ key: "syncCursor", value: pagination.nextCursor });
  // Only a drained feed marks the mirror readable; a half-applied snapshot must not answer reads.
  if (!pagination.hasMore) await meta.put({ key: "syncedAt", value: page.serverTime });
  await tx.done;
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

  for (;;) {
    const page = await fetchPage({ cursor, limit });
    // Rows are applied by id with put, so the deliberate 60-second overlap of D-14 costs nothing.
    await applyPage(handle, page);
    pages += 1;
    rows += page.pagination.count;

    const next = page.pagination.nextCursor;
    if (!page.pagination.hasMore) {
      return { pages, rows, cursor: next, serverTime: page.serverTime };
    }
    if (next === cursor) throw new SyncFeedStalledError(next);
    cursor = next;
  }
}
