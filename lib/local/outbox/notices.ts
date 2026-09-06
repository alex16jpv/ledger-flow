import type { SyncOpResult } from "@/types/api";

import type { VaultDb, WriteTransaction } from "./queue";

export type SyncWarning = NonNullable<SyncOpResult["warnings"]>[number];

// What the server warned about a write that landed degraded, kept per row so the screen where the
// user fixes it can say why. `CATEGORY_ARCHIVED_DROPPED` is the only one today: the category was
// archived online while this device had no network, so the movement was saved without it (F-57).
export interface SyncNotice {
  code: SyncWarning;
  id: string;
  at: string;
}

const NOTICES_KEY = "syncNotices" as const;

// A notice is read once and dropped when the row it explains stops needing a review, so the list is
// short by construction. The cap is the belt for a device that never opens the review screen.
const NOTICES_LIMIT = 50;

const isNotice = (value: unknown): value is SyncNotice => {
  const notice = value as Partial<SyncNotice> | null;
  return (
    typeof notice?.code === "string" &&
    typeof notice.id === "string" &&
    typeof notice.at === "string"
  );
};

function parse(value: string | number | null | undefined): SyncNotice[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isNotice) : [];
  } catch {
    // Written by an older version of this code, or truncated: a notice is not worth an error.
    return [];
  }
}

// Runs inside the transaction that settles the operation the warning belongs to: the row, the queue
// and the reason it landed degraded commit together.
export async function recordNotices(
  tx: WriteTransaction,
  notices: readonly SyncNotice[],
): Promise<void> {
  if (notices.length === 0) return;
  const store = tx.objectStore("meta");
  // One notice per row: a row that lands degraded twice is the same news, told again.
  const kept = parse((await store.get(NOTICES_KEY))?.value).filter(
    (notice) => !notices.some((fresh) => fresh.id === notice.id),
  );
  const next = [...kept, ...notices].slice(-NOTICES_LIMIT);
  await store.put({ key: NOTICES_KEY, value: JSON.stringify(next) });
}

export async function readNotices(db: VaultDb): Promise<SyncNotice[]> {
  return parse((await db.get("meta", NOTICES_KEY))?.value);
}

// A notice explains a row that is waiting for details: once the row is reviewed, deleted or gone
// from the mirror, the explanation goes with it. Called by the screen that shows them.
export async function pruneNotices(db: VaultDb): Promise<SyncNotice[]> {
  const notices = await readNotices(db);
  if (notices.length === 0) return notices;
  const kept: SyncNotice[] = [];
  for (const notice of notices) {
    const record = await db.get("transactions", notice.id);
    if (record?.row.pendingDetails && !record.row.deletedAt) kept.push(notice);
  }
  if (kept.length !== notices.length) {
    await db.put("meta", { key: NOTICES_KEY, value: JSON.stringify(kept) });
  }
  return kept;
}
