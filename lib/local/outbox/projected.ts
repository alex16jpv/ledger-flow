import type { SyncTransaction, User } from "@/types/api";

import { PROFILE_KEY } from "../schema";
import type { WriteTransaction } from "./queue";

// With no profile nothing is queued: the write goes to the server as it did before O-F4.
export class NotProjectableError extends Error {
  constructor(what: string) {
    super(`The mirror cannot project ${what}`);
    this.name = "NotProjectableError";
  }
}

// Invariant 2: stamped fields are copied from the profile and marked as a projection.
export interface ProjectionContext {
  userId: string;
  currency: string;
  // The zone that freezes the accounting day of a row written here, the same one the server uses.
  timeZone: string;
  occurredAt: string;
}

export async function projectionContext(
  tx: WriteTransaction,
  occurredAt: string,
): Promise<ProjectionContext> {
  const record = await tx.objectStore("profile").get(PROFILE_KEY);
  if (!record) throw new NotProjectableError("a row without the profile it belongs to");
  const profile: User = record.row;
  return {
    userId: profile.id,
    currency: profile.currency,
    timeZone: profile.timezone,
    occurredAt,
  };
}

// The mirror resolves the same default the server would when the sheet picked no account.
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

// A key carrying `undefined` is a key the form did not send; spreading it would erase it.
export function patch<T extends object>(row: T, changes: Partial<T>): T {
  const next = { ...row };
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}
