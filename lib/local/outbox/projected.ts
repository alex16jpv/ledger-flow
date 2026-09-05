import type { SyncTransaction, User } from "@/types/api";

import { PROFILE_KEY } from "../schema";
import type { WriteTransaction } from "./queue";

// Thrown when the mirror cannot say what the row would look like — no profile yet, so no currency
// and no owner. Nothing is queued then: the write goes to the server as it did before O-F4, and a
// write with no network fails the way it always did rather than inventing a row.
export class NotProjectableError extends Error {
  constructor(what: string) {
    super(`The mirror cannot project ${what}`);
    this.name = "NotProjectableError";
  }
}

// The fields the server stamps and the client never sends (invariant 2). A row created offline has
// to show them anyway, so they are copied from the profile the mirror already holds and the figure
// is marked as a projection until the server answers with the real one.
export interface ProjectionContext {
  userId: string;
  currency: string;
  occurredAt: string;
}

export async function projectionContext(
  tx: WriteTransaction,
  occurredAt: string,
): Promise<ProjectionContext> {
  const record = await tx.objectStore("profile").get(PROFILE_KEY);
  if (!record) throw new NotProjectableError("a row without the profile it belongs to");
  const profile: User = record.row;
  return { userId: profile.id, currency: profile.currency, occurredAt };
}

// Quick capture leaves the account to the server when the sheet did not pick one, so the mirror
// resolves the same default the server would.
export async function defaultAccountId(tx: WriteTransaction): Promise<string | null> {
  for (const record of await tx.objectStore("accounts").getAll()) {
    if (record.archived === 0 && record.row.isDefault) return record.id;
  }
  return null;
}

export const balanceOf = (row: SyncTransaction) => ({
  type: row.type,
  amount: row.amount,
  fromAccountId: row.fromAccountId,
  toAccountId: row.toAccountId,
  deletedAt: row.deletedAt,
});

export const accountsOf = (row: SyncTransaction): (string | null)[] => [
  row.fromAccountId,
  row.toAccountId,
];

export const isFirstAccount = async (tx: WriteTransaction): Promise<boolean> =>
  (await tx.objectStore("accounts").count()) === 0;

// A form sends the fields it changed; a key carrying `undefined` is a key it did not send, and
// spreading it over the mirror row would erase what the server still has.
export function patch<T extends object>(row: T, changes: Partial<T>): T {
  const next = { ...row };
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}
