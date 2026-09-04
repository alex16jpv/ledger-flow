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
  "userId" | "mirrorVersion" | "outboxVersion" | "syncCursor" | "syncedAt" | "outboxSeq";

export interface MetaRecord {
  key: MetaKey;
  value: string | number | null;
}

// IndexedDB refuses booleans and nulls as keys, so every filter the lists use is stored as a
// sibling key: 0/1 for flags, and omitted entirely where the index must skip the row.
export interface MirrorRecord<T> {
  id: string;
  row: T;
  updatedAt: string;
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
  // Absent on deleted rows: a compound index skips a record when any part of its key path is
  // missing, which is what keeps the list cursor from ever walking a tombstone.
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

export function accountRecord(row: Account): AccountRecord {
  return { id: row.id, row, updatedAt: row.updatedAt, archived: row.archivedAt ? 1 : 0 };
}

export function categoryRecord(row: Category): CategoryRecord {
  return { id: row.id, row, updatedAt: row.updatedAt, archived: row.archivedAt ? 1 : 0 };
}

export function budgetRecord(row: SyncBudget): BudgetRecord {
  return { id: row.id, row, updatedAt: row.updatedAt, archived: row.archivedAt ? 1 : 0 };
}

export function profileRecord(row: User): ProfileRecord {
  return { id: PROFILE_KEY, row, updatedAt: row.updatedAt };
}

export function transactionRecord(row: SyncTransaction): TransactionRecord {
  const deleted = row.deletedAt ? 1 : 0;
  const record: TransactionRecord = {
    id: row.id,
    row,
    updatedAt: row.updatedAt,
    date: row.date,
    deleted,
  };
  if (!deleted) record.liveDate = row.date;
  if (row.categoryId) record.categoryId = row.categoryId;
  if (row.fromAccountId) record.fromAccountId = row.fromAccountId;
  if (row.toAccountId) record.toAccountId = row.toAccountId;
  if (!deleted && row.pendingDetails) record.pendingReview = 1;
  return record;
}
