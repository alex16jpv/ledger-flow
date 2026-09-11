import type { DBSchema } from "idb";

import type { Account, Category, SyncBudget, SyncTransaction, User } from "@/types/api";

export const VAULT_DB_PREFIX = "lf-vault-";

export function vaultDatabaseName(userId: string): string {
  return `${VAULT_DB_PREFIX}${userId}`;
}

export const MIRROR_STORES = [
  "profile",
  "accounts",
  "categories",
  "transactions",
  "budgets",
] as const;
export type MirrorStore = (typeof MIRROR_STORES)[number];

export const PROFILE_KEY = "me";

export type MetaKey =
  | "userId"
  | "mirrorVersion"
  | "outboxVersion"
  | "syncCursor"
  | "syncedAt"
  | "outboxSeq"
  // D-24: a store of its own would cost a mirror version bump for notices a pull cannot rebuild.
  | "syncNotices"
  // F-66: learned from the `serverTime` of every answer, for when there is no network left.
  | "clockOffsetMs";

export interface MetaRecord {
  key: MetaKey;
  value: string | number | null;
}

// IndexedDB refuses booleans and nulls as keys, so every filter is stored as a sibling key.
export interface MirrorRecord<T> {
  id: string;
  row: T;
  updatedAt: string;
  // D-24: kept only while the outbox holds operations on this row; absent, `row` is the server's.
  server?: T;
}

export interface ProfileRecord extends MirrorRecord<User> {
  id: typeof PROFILE_KEY;
}

export interface ArchivableRecord<T> extends MirrorRecord<T> {
  archived: 0 | 1;
}

export type AccountRecord = ArchivableRecord<Account>;
export type CategoryRecord = ArchivableRecord<Category>;
export type BudgetRecord = ArchivableRecord<SyncBudget>;

export interface TransactionRecord extends MirrorRecord<SyncTransaction> {
  deleted: 0 | 1;
  date: string;
  // Absent on deleted rows: a compound index skips a record with a missing key path.
  liveDate?: string;
  categoryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  pendingReview?: 1;
}

export type OutboxEntity = "account" | "category" | "transaction" | "budget";
export type OutboxStatus = "pending" | "sending" | "conflict" | "failed";

export interface OutboxOperation {
  seq: number;
  opId: string;
  opVersion: number;
  entity: OutboxEntity;
  entityId: string;
  action: string;
  occurredAt: string;
  payload: unknown;
  baseUpdatedAt?: string;
  dependsOn: string[];
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  // F-21: set once by the engine after a `409 ID_TAKEN`; a second collision on a v7 is a bug.
  reminted?: true;
  // O-B2: the server's row at the refusal; a `DUPLICATE` carries somebody else's (`ownServerRow`).
  serverRow?: unknown;
  // F-58: archived online while this device had no network, so the movement waits for a restore.
  archivedId?: string;
}

export interface VaultSchema extends DBSchema {
  profile: { key: string; value: ProfileRecord };
  accounts: { key: string; value: AccountRecord; indexes: { updatedAt: string; archived: number } };
  categories: {
    key: string;
    value: CategoryRecord;
    indexes: { updatedAt: string; archived: number };
  };
  budgets: { key: string; value: BudgetRecord; indexes: { updatedAt: string; archived: number } };
  transactions: {
    key: string;
    value: TransactionRecord;
    indexes: {
      updatedAt: string;
      date: string;
      dateCursor: [string, string];
      categoryId: string;
      fromAccountId: string;
      toAccountId: string;
      pendingReview: number;
      deleted: number;
    };
  };
  outbox: {
    key: number;
    value: OutboxOperation;
    indexes: { opId: string; status: string; entity: [string, string] };
  };
  meta: { key: string; value: MetaRecord };
}

export function accountRecord(row: Account, server?: Account): AccountRecord {
  return {
    id: row.id,
    row,
    updatedAt: row.updatedAt,
    archived: row.archivedAt ? 1 : 0,
    ...(server ? { server } : {}),
  };
}

export function categoryRecord(row: Category, server?: Category): CategoryRecord {
  return {
    id: row.id,
    row,
    updatedAt: row.updatedAt,
    archived: row.archivedAt ? 1 : 0,
    ...(server ? { server } : {}),
  };
}

export function budgetRecord(row: SyncBudget, server?: SyncBudget): BudgetRecord {
  return {
    id: row.id,
    row,
    updatedAt: row.updatedAt,
    archived: row.archivedAt ? 1 : 0,
    ...(server ? { server } : {}),
  };
}

export function profileRecord(row: User): ProfileRecord {
  return { id: PROFILE_KEY, row, updatedAt: row.updatedAt };
}

export function transactionRecord(
  row: SyncTransaction,
  server?: SyncTransaction,
): TransactionRecord {
  const deleted = row.deletedAt ? 1 : 0;
  const record: TransactionRecord = {
    id: row.id,
    row,
    updatedAt: row.updatedAt,
    date: row.date,
    deleted,
    ...(server ? { server } : {}),
  };
  if (!deleted) record.liveDate = row.date;
  if (row.categoryId) record.categoryId = row.categoryId;
  if (row.fromAccountId) record.fromAccountId = row.fromAccountId;
  if (row.toAccountId) record.toAccountId = row.toAccountId;
  if (!deleted && row.pendingDetails) record.pendingReview = 1;
  return record;
}
