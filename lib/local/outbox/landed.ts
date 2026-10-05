import type { Account, Restamp } from "@/types/api";

import { deriveBalances } from "../derive";
import { toCents } from "../derive/money";
import type { OutboxOperation } from "../schema";
import { type MoneyEffect, operationPayload } from "./envelope";
import type { VaultDb, WriteTransaction } from "./queue";

export interface LandedPart {
  accountId: string;
  cents: number;
  // The account's `updatedAt` once the write moved it, from `restamped`; null when the answer named none.
  stamp: string | null;
}

export interface LandedEffect {
  opId: string;
  parts: LandedPart[];
}

const LANDED_KEY = "landedEffects" as const;

const isPart = (value: unknown): value is LandedPart => {
  const part = value as Partial<LandedPart> | null;
  return typeof part?.accountId === "string" && typeof part.cents === "number";
};

const isLanded = (value: unknown): value is LandedEffect => {
  const entry = value as Partial<LandedEffect> | null;
  return typeof entry?.opId === "string" && Array.isArray(entry.parts) && entry.parts.every(isPart);
};

function parse(value: string | number | null | undefined): LandedEffect[] {
  if (typeof value !== "string" || value.length === 0) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter(isLanded) : [];
}

interface MetaReader {
  get: (key: typeof LANDED_KEY) => Promise<{ value: string | number | null } | undefined>;
}

export async function landedFrom(meta: MetaReader): Promise<LandedEffect[]> {
  return parse((await meta.get(LANDED_KEY))?.value);
}

export const readLanded = (db: VaultDb): Promise<LandedEffect[]> =>
  landedFrom(db.transaction("meta").store);

const landedIn = (tx: WriteTransaction): Promise<LandedEffect[]> =>
  landedFrom(tx.objectStore("meta"));

export async function landedOpIds(db: VaultDb): Promise<Set<string>> {
  return new Set((await readLanded(db)).map((entry) => entry.opId));
}

// Every way the mirror is emptied takes these along: the snapshot behind it holds what they moved.
export const forgetLanded = (meta: {
  delete: (key: typeof LANDED_KEY) => Promise<unknown>;
}): Promise<unknown> => meta.delete(LANDED_KEY);

async function store(tx: WriteTransaction, entries: LandedEffect[]): Promise<void> {
  if (entries.length === 0) await forgetLanded(tx.objectStore("meta"));
  else await tx.objectStore("meta").put({ key: LANDED_KEY, value: JSON.stringify(entries) });
}

function partsOf(effect: MoneyEffect, restamped: readonly Restamp[]): LandedPart[] {
  const ids = new Set<string>();
  for (const side of [effect.before, effect.after]) {
    if (side?.fromAccountId) ids.add(side.fromAccountId);
    if (side?.toAccountId) ids.add(side.toAccountId);
  }
  const opening = [...ids].map((id) => ({ id, openingBalance: 0 }));
  const removed = new Map(
    deriveBalances(opening, effect.before ? [effect.before] : []).map((row) => [
      row.accountId,
      toCents(row.balance),
    ]),
  );
  const parts: LandedPart[] = [];
  for (const row of deriveBalances(opening, effect.after ? [effect.after] : [])) {
    const cents = toCents(row.balance) - (removed.get(row.accountId) ?? 0);
    if (cents === 0) continue;
    const restamp = restamped.find((one) => one.entity === "account" && one.id === row.accountId);
    parts.push({ accountId: row.accountId, cents, stamp: restamp?.updatedAt ?? null });
  }
  return parts;
}

// In the transaction that takes the operation out of the queue, so the balance never misses it.
export async function keepLanded(
  tx: WriteTransaction,
  operation: OutboxOperation | undefined,
  restamped: readonly Restamp[],
): Promise<void> {
  const effect = operation && operationPayload(operation).effect;
  if (!operation || !effect) return;
  const parts = partsOf(effect, restamped);
  if (parts.length === 0) return;
  const entries = await landedIn(tx);
  await store(tx, [
    ...entries.filter((entry) => entry.opId !== operation.opId),
    { opId: operation.opId, parts },
  ]);
}

async function keepOnly(
  tx: WriteTransaction,
  keep: (entry: LandedEffect) => LandedEffect | null,
): Promise<boolean> {
  const entries = await landedIn(tx);
  const kept: LandedEffect[] = [];
  let changed = false;
  for (const entry of entries) {
    const next = keep(entry);
    if (next !== entry) changed = true;
    if (next !== null && next.parts.length > 0) kept.push(next);
  }
  if (changed) await store(tx, kept);
  return changed;
}

// Only for a row the server sent: a restamp moves `updatedAt` and leaves the old balance behind.
export function releaseByAccount(tx: WriteTransaction, account: Account): Promise<boolean> {
  return keepOnly(tx, (entry) => {
    const parts = entry.parts.filter(
      (part) =>
        part.accountId !== account.id || part.stamp === null || account.updatedAt < part.stamp,
    );
    return parts.length === entry.parts.length ? entry : { ...entry, parts };
  });
}

// The last page of a pull that began after these landed holds every balance they moved.
export function releaseLanded(tx: WriteTransaction, before: ReadonlySet<string>): Promise<boolean> {
  return keepOnly(tx, (entry) => (before.has(entry.opId) ? null : entry));
}

export function landedCents(entries: readonly LandedEffect[]): Map<string, number> {
  const cents = new Map<string, number>();
  for (const part of entries.flatMap((entry) => entry.parts)) {
    cents.set(part.accountId, (cents.get(part.accountId) ?? 0) + part.cents);
  }
  return cents;
}
