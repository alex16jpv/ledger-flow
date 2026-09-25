import { reportError } from "@/lib/observability/reporter";

import type { VaultHandle } from "../db";
import { outboxStatusStore } from "../outbox/status";
import { currentVault, mirrorReady, ownVault, vaultReady } from "../repository/read";
import type { TransactionRecord, VaultSchema } from "../schema";
import { createSuggestBuilder, SUGGEST_ROW_CAP, type SuggestIndex } from "./index";
import { markSuggestionsStale, onSuggestionsStale, suggestionsVersion } from "./stale";

export { splitMatch, SUGGEST_LIMIT, suggestDescriptions, suggestTags } from "./index";

export const SUGGEST_BATCH = 1_000;
// Idle never comes on a page that keeps animating; the slice runs anyway after this long.
const IDLE_TIMEOUT_MS = 1_000;

type Listener = () => void;

interface Built {
  vault: VaultHandle;
  version: number;
  index: SuggestIndex;
}

interface Job {
  vault: VaultHandle;
  version: number;
}

const listeners = new Set<Listener>();
let built: Built | null = null;
let job: Job | null = null;
let cap = SUGGEST_ROW_CAP;

function notify(): void {
  for (const listener of listeners) listener();
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(
        () => {
          resolve();
        },
        { timeout: IDLE_TIMEOUT_MS },
      );
    } else {
      setTimeout(resolve, 0);
    }
  });
}

type Db = VaultHandle["db"];
type DateCursorKey = VaultSchema["transactions"]["indexes"]["dateCursor"];

async function readBatch(db: Db, before: DateCursorKey | undefined): Promise<TransactionRecord[]> {
  const rows: TransactionRecord[] = [];
  const index = db.transaction("transactions").store.index("dateCursor");
  const range = before ? IDBKeyRange.upperBound(before, true) : null;
  for await (const cursor of index.iterate(range, "prev")) {
    rows.push(cursor.value);
    if (rows.length >= SUGGEST_BATCH) break;
  }
  return rows;
}

async function build(vault: VaultHandle): Promise<SuggestIndex> {
  const builder = createSuggestBuilder(cap);
  let before: DateCursorKey | undefined;
  for (;;) {
    await idle();
    const batch = await readBatch(vault.db, before);
    for (const record of batch) {
      if (!builder.add(record.row)) return builder.finish();
    }
    const last = batch.at(-1);
    if (batch.length < SUGGEST_BATCH || !last) return builder.finish();
    before = [last.liveDate ?? last.date, last.id];
  }
}

const outdated = (mine: Job): boolean =>
  suggestionsVersion() !== mine.version || ownVault() !== mine.vault;

function ensure(): void {
  const vault = ownVault();
  const version = suggestionsVersion();
  if (!vault) {
    if (built) {
      built = null;
      notify();
    }
    return;
  }
  if (listeners.size === 0) return;
  if (built?.vault === vault && built.version === version) return;
  if (job) return;
  const mine: Job = { vault, version };
  job = mine;
  void (async () => {
    if (!(await mirrorReady(vault))) return;
    const index = await build(vault);
    if (ownVault() !== mine.vault) return;
    built = { vault, version, index };
    notify();
  })()
    .catch((error: unknown) => {
      if (ownVault() === mine.vault) reportError(error, "vault");
    })
    .finally(() => {
      job = null;
      if (outdated(mine)) ensure();
    });
}

onSuggestionsStale(ensure);
outboxStatusStore.subscribe(markSuggestionsStale);

export const suggestStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    ensure();
    void vaultReady().then(ensure);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): SuggestIndex | null => (built?.vault === currentVault() ? built.index : null),
  getServerSnapshot: (): SuggestIndex | null => null,
};

// Test seam: a cap of twenty thousand rows would take fake-indexeddb minutes to prove.
export function resetSuggestStore(options: { cap?: number } = {}): void {
  built = null;
  job = null;
  cap = options.cap ?? SUGGEST_ROW_CAP;
}
