import type { IDBPDatabase } from "idb";

import type { SyncTransaction } from "@/types/api";

import { widenedBound } from "../derive";
import { countsAsYours, deriveShared } from "../derive/shared";
import { PROFILE_KEY, type VaultSchema } from "../schema";

// An array key [d, id] sorts after [d], so an open bound on [to] is the server's `$lt`.
export function dateCursorRange(from?: string, to?: string): IDBKeyRange | null {
  if (from !== undefined && to !== undefined) return IDBKeyRange.bound([from], [to], false, true);
  if (from !== undefined) return IDBKeyRange.lowerBound([from]);
  if (to !== undefined) return IDBKeyRange.upperBound([to], true);
  return null;
}

// F-17: a bound with an offset would drop its own last day, and `null` is the server's 400.
export function storedStamp(bound: string): string | null {
  const at = new Date(bound);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

const asStoredStamp = (bound?: string): string | undefined => {
  if (bound === undefined) return undefined;
  const stamp = storedStamp(bound);
  if (stamp === null) throw new RangeError(`Not a date: ${bound}`);
  return stamp;
};

// D-18: the dateCursor index, never a walk of the store; a tombstone has no `liveDate`.
export async function liveRowsInWindow(
  db: IDBPDatabase<VaultSchema>,
  from?: string,
  to?: string,
): Promise<SyncTransaction[]> {
  const rows: SyncTransaction[] = [];
  const index = db.transaction("transactions").store.index("dateCursor");
  // The range is widened so it cannot miss an edge row, and `withinDays` is what decides.
  const range = dateCursorRange(
    widenedBound(asStoredStamp(from), -1),
    widenedBound(asStoredStamp(to), 1),
  );
  for await (const entry of index.iterate(range)) rows.push(entry.value.row);
  return withCountsAsYours(db, rows);
}

// What a movement counts as yours falls the moment a payment is recorded, and with no network that
// payment is only in the mirror: the figure the budgets and Stats measure is worked out from it.
async function withCountsAsYours(
  db: IDBPDatabase<VaultSchema>,
  rows: SyncTransaction[],
): Promise<SyncTransaction[]> {
  if (!rows.some((row) => row.sharedExpenseId !== null)) return rows;
  const [groups, expenses, settlements] = await Promise.all([
    db.getAll("sharedGroups"),
    db.getAll("sharedExpenses"),
    db.getAll("settlements"),
  ]);
  const ledger = deriveShared({
    groups: groups.map((record) => record.row),
    expenses: expenses.map((record) => record.row),
    settlements: settlements.map((record) => record.row),
  });
  return rows.map((row) =>
    row.sharedExpenseId !== null && ledger.cameBack.has(row.sharedExpenseId)
      ? { ...row, countsAsYours: countsAsYours(row, ledger) }
      : row,
  );
}

// Absent means the mirror cannot answer — never fall back to the device's zone.
export async function mirrorTimeZone(db: IDBPDatabase<VaultSchema>): Promise<string | undefined> {
  const record = await db.get("profile", PROFILE_KEY);
  return record?.row.timezone;
}
