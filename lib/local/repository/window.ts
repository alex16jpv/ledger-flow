import type { IDBPDatabase } from "idb";

import type { SyncTransaction } from "@/types/api";

import { PROFILE_KEY, type VaultSchema } from "../schema";

// Comparing the dates as strings is comparing them as instants: they are the ISO stamps the server
// printed. An array key [d, id] sorts after [d], so an open bound on [to] is the server's `$lt`.
export function dateCursorRange(from?: string, to?: string): IDBKeyRange | null {
  if (from !== undefined && to !== undefined) return IDBKeyRange.bound([from], [to], false, true);
  if (from !== undefined) return IDBKeyRange.lowerBound([from]);
  if (to !== undefined) return IDBKeyRange.upperBound([to], true);
  return null;
}

// The index compares the stamps as strings, and a stored date is always the feed's UTC one. A bound
// carrying an offset instead ("2025-12-01T00:00:00-05:00") would compare below every row of its own
// last day and drop them, so a bound is normalised to the same shape before it is used as a key.
const asStoredStamp = (bound?: string): string | undefined =>
  bound === undefined ? undefined : new Date(bound).toISOString();

// Every derived figure is bounded by a window, and this is how its rows are chosen: the dateCursor
// index, never a walk of the whole store (D-18). A tombstone carries no `liveDate`, so the index
// cannot reach a deleted row and no caller has to filter one out.
export async function liveRowsInWindow(
  db: IDBPDatabase<VaultSchema>,
  from?: string,
  to?: string,
): Promise<SyncTransaction[]> {
  const rows: SyncTransaction[] = [];
  const index = db.transaction("transactions").store.index("dateCursor");
  const range = dateCursorRange(asStoredStamp(from), asStoredStamp(to));
  for await (const entry of index.iterate(range)) rows.push(entry.value.row);
  return rows;
}

// The zone every window is built in. The server reads it from the user; offline the mirror holds
// the same row. Absent means the mirror cannot answer — never "fall back to the device's zone",
// which would silently bucket a day differently from the server.
export async function mirrorTimeZone(db: IDBPDatabase<VaultSchema>): Promise<string | undefined> {
  const record = await db.get("profile", PROFILE_KEY);
  return record?.row.timezone;
}
