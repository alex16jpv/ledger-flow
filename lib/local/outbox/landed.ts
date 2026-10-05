import type { SyncChangesResponse } from "@/types/api";

import type { OutboxEntity, OutboxOperation } from "../schema";
import { type MoneyEffect, operationPayload } from "./envelope";
import type { VaultDb, WriteTransaction } from "./queue";

// T-260: a write the server applied keeps moving the balance until a pull brings the one that holds it.
export interface LandedEffect {
  opId: string;
  entity: OutboxEntity;
  entityId: string;
  // The row's `updatedAt` in the answer: a copy of the row at least this new was read after the write.
  stamp: string | null;
  effect: MoneyEffect;
}

const LANDED_KEY = "landedEffects" as const;

const isLanded = (value: unknown): value is LandedEffect => {
  const entry = value as Partial<LandedEffect> | null;
  return (
    typeof entry?.opId === "string" &&
    typeof entry.entity === "string" &&
    typeof entry.entityId === "string" &&
    typeof entry.effect === "object"
  );
};

function parse(value: string | number | null | undefined): LandedEffect[] {
  if (typeof value !== "string" || value.length === 0) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter(isLanded) : [];
}

export async function readLanded(db: VaultDb): Promise<LandedEffect[]> {
  return parse((await db.get("meta", LANDED_KEY))?.value);
}

export async function landedOpIds(db: VaultDb): Promise<Set<string>> {
  return new Set((await readLanded(db)).map((entry) => entry.opId));
}

export async function landedIn(tx: WriteTransaction): Promise<LandedEffect[]> {
  return parse((await tx.objectStore("meta").get(LANDED_KEY))?.value);
}

async function store(tx: WriteTransaction, entries: LandedEffect[]): Promise<void> {
  const meta = tx.objectStore("meta");
  if (entries.length === 0) await meta.delete(LANDED_KEY);
  else await meta.put({ key: LANDED_KEY, value: JSON.stringify(entries) });
}

const movesNothing = (effect: MoneyEffect): boolean =>
  JSON.stringify(effect.before) === JSON.stringify(effect.after);

// In the transaction that takes the operation out of the queue, so the balance never misses it.
export async function keepLanded(
  tx: WriteTransaction,
  operation: OutboxOperation | undefined,
  stamp: string | undefined,
): Promise<void> {
  const effect = operation && operationPayload(operation).effect;
  if (!operation || !effect || movesNothing(effect)) return;
  const entries = await landedIn(tx);
  await store(tx, [
    ...entries.filter((entry) => entry.opId !== operation.opId),
    {
      opId: operation.opId,
      entity: operation.entity,
      entityId: operation.entityId,
      stamp: stamp ?? null,
      effect,
    },
  ]);
}

function rowsOf(changes: SyncChangesResponse["changes"], entity: OutboxEntity) {
  if (entity === "transaction") return changes.transactions;
  if (entity === "settlement") return changes.settlements;
  return [];
}

// The server writes the row and the balance together, so a page with the row read after it has both.
function broughtBy(entry: LandedEffect, changes: SyncChangesResponse["changes"]): boolean {
  const { stamp } = entry;
  if (stamp === null) return false;
  return rowsOf(changes, entry.entity).some(
    (row) => row.id === entry.entityId && row.updatedAt >= stamp,
  );
}

export interface LandedRelease {
  changes: SyncChangesResponse["changes"];
  // Landed before this pull asked for its first page, so its last page holds every one of them.
  before: ReadonlySet<string>;
  finished: boolean;
}

export async function releaseLanded(tx: WriteTransaction, page: LandedRelease): Promise<boolean> {
  const entries = await landedIn(tx);
  const kept = entries.filter(
    (entry) => !(page.finished && page.before.has(entry.opId)) && !broughtBy(entry, page.changes),
  );
  if (kept.length === entries.length) return false;
  await store(tx, kept);
  return true;
}
