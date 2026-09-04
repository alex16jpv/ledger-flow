import { api } from "@/lib/api/client";
import type { SyncChangesResponse } from "@/types/api";

import type { VaultHandle } from "./db";
import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  MIRROR_STORES,
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
  const tx = handle.db.transaction([...MIRROR_STORES, "meta"], "readwrite");
  if (changes.user) await tx.objectStore("profile").put(profileRecord(changes.user));
  for (const row of changes.accounts) await tx.objectStore("accounts").put(accountRecord(row));
  for (const row of changes.categories) await tx.objectStore("categories").put(categoryRecord(row));
  for (const row of changes.transactions) {
    await tx.objectStore("transactions").put(transactionRecord(row));
  }
  for (const row of changes.budgets) await tx.objectStore("budgets").put(budgetRecord(row));

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
