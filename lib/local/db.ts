import { type IDBPDatabase, openDB } from "idb";

import type { User } from "@/types/api";

import {
  MIRROR_STORES,
  type OutboxOperation,
  PROFILE_KEY,
  vaultDatabaseName,
  type VaultSchema,
} from "./schema";

export const VAULT_SCHEMA_VERSION = 2;
export const MIRROR_VERSION = 3;
export const OUTBOX_VERSION = 1;

// Invariant 7: null means the operation cannot be carried forward, so the upgrade blocks.
export type OutboxMigration = (operation: OutboxOperation) => OutboxOperation | null;
export type OutboxMigrations = Readonly<Record<number, OutboxMigration>>;

export const OUTBOX_MIGRATIONS: OutboxMigrations = {};

export interface VaultDefinition {
  schemaVersion: number;
  mirrorVersion: number;
  outboxVersion: number;
  outboxMigrations: OutboxMigrations;
}

export const VAULT: VaultDefinition = {
  schemaVersion: VAULT_SCHEMA_VERSION,
  mirrorVersion: MIRROR_VERSION,
  outboxVersion: OUTBOX_VERSION,
  outboxMigrations: OUTBOX_MIGRATIONS,
};

export type OutboxState = "current" | "migrated" | "blocked";

export interface VaultHandle {
  db: IDBPDatabase<VaultSchema>;
  userId: string;
  mirrorReset: boolean;
  outbox: OutboxState;
  blockedOperations: number;
  // F-65: which ones, so the tray can show them. Empty unless `outbox` is blocked.
  blockedSeqs: readonly number[];
  close: () => void;
}

export class VaultUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("IndexedDB is not available in this context", { cause });
    this.name = "VaultUnavailableError";
  }
}

export function isVaultSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function createStores(db: IDBPDatabase<VaultSchema>): void {
  if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });

  for (const name of ["accounts", "categories", "budgets", "contacts", "sharedGroups"] as const) {
    if (db.objectStoreNames.contains(name)) continue;
    const store = db.createObjectStore(name, { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("archived", "archived");
  }

  if (!db.objectStoreNames.contains("sharedExpenses")) {
    const store = db.createObjectStore("sharedExpenses", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("deleted", "deleted");
    store.createIndex("groupId", "groupId");
  }

  if (!db.objectStoreNames.contains("settlements")) {
    const store = db.createObjectStore("settlements", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("deleted", "deleted");
  }

  if (!db.objectStoreNames.contains("transactions")) {
    const store = db.createObjectStore("transactions", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("date", "date");
    store.createIndex("dateCursor", ["liveDate", "id"]);
    store.createIndex("categoryId", "categoryId");
    store.createIndex("fromAccountId", "fromAccountId");
    store.createIndex("toAccountId", "toAccountId");
    store.createIndex("pendingReview", "pendingReview");
    store.createIndex("deleted", "deleted");
  }

  if (!db.objectStoreNames.contains("outbox")) {
    const store = db.createObjectStore("outbox", { keyPath: "seq" });
    store.createIndex("opId", "opId", { unique: true });
    store.createIndex("status", "status");
    store.createIndex("entity", ["entity", "entityId"]);
  }

  if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
}

async function readMetaNumber(
  db: IDBPDatabase<VaultSchema>,
  key: "mirrorVersion" | "outboxVersion",
): Promise<number | null> {
  const record = await db.get("meta", key);
  return typeof record?.value === "number" ? record.value : null;
}

async function resetMirror(db: IDBPDatabase<VaultSchema>, mirrorVersion: number): Promise<void> {
  const tx = db.transaction([...MIRROR_STORES, "meta"], "readwrite");
  for (const name of MIRROR_STORES) await tx.objectStore(name).clear();
  const meta = tx.objectStore("meta");
  // The cursor goes with the rows it describes; the outbox store is deliberately not in this tx.
  await meta.delete("syncCursor");
  await meta.delete("syncedAt");
  await meta.put({ key: "mirrorVersion", value: mirrorVersion });
  await tx.done;
}

// Only walks forward: an operation from a newer build blocks an older one, never reinterpreted.
function migrateOperation(
  operation: OutboxOperation,
  target: number,
  migrations: OutboxMigrations,
): OutboxOperation | null {
  let current: OutboxOperation = operation;
  while (current.opVersion < target) {
    const step: OutboxMigration | undefined = migrations[current.opVersion];
    if (!step) return null;
    const next: OutboxOperation | null = step(current);
    if (!next || next.opVersion <= current.opVersion) return null;
    current = next;
  }
  return current.opVersion === target ? current : null;
}

async function upgradeOutbox(
  db: IDBPDatabase<VaultSchema>,
  definition: VaultDefinition,
): Promise<{ state: OutboxState; blocked: readonly number[] }> {
  const stored = await readMetaNumber(db, "outboxVersion");
  if (stored === definition.outboxVersion) return { state: "current", blocked: [] };

  const pending = await db.getAll("outbox");
  const migrated: OutboxOperation[] = [];
  const blocked: number[] = [];
  for (const operation of pending) {
    const next = migrateOperation(operation, definition.outboxVersion, definition.outboxMigrations);
    if (next) migrated.push(next);
    else blocked.push(operation.seq);
  }
  if (blocked.length > 0) return { state: "blocked", blocked };

  const tx = db.transaction(["outbox", "meta"], "readwrite");
  const outbox = tx.objectStore("outbox");
  for (const operation of migrated) await outbox.put(operation);
  await tx.objectStore("meta").put({ key: "outboxVersion", value: definition.outboxVersion });
  await tx.done;
  return { state: migrated.length > 0 ? "migrated" : "current", blocked: [] };
}

export interface OpenVaultOptions {
  // F-14: once another tab's upgrade closes this handle, every call throws `InvalidStateError`.
  onClosed?: () => void;
}

export async function openVault(
  userId: string,
  definition: VaultDefinition = VAULT,
  options: OpenVaultOptions = {},
): Promise<VaultHandle> {
  if (!isVaultSupported()) throw new VaultUnavailableError();

  const db = await openDB<VaultSchema>(vaultDatabaseName(userId), definition.schemaVersion, {
    upgrade(database) {
      createStores(database);
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // Another tab is upgrading the schema; holding this connection open would stall it forever.
      (event.target as IDBDatabase | null)?.close();
      options.onClosed?.();
    },
  });

  await db.put("meta", { key: "userId", value: userId });

  const storedMirrorVersion = await readMetaNumber(db, "mirrorVersion");
  const mirrorReset = storedMirrorVersion !== definition.mirrorVersion;
  if (mirrorReset) await resetMirror(db, definition.mirrorVersion);

  const outbox = await upgradeOutbox(db, definition);

  return {
    db,
    userId,
    mirrorReset,
    outbox: outbox.state,
    blockedOperations: outbox.blocked.length,
    blockedSeqs: outbox.blocked,
    close: () => {
      db.close();
    },
  };
}

// D-20: Firefox has no `indexedDB.databases()`, and reading the no as a loss invents one.
export function canListVaults(): boolean {
  return isVaultSupported() && typeof indexedDB.databases === "function";
}

export async function vaultExists(userId: string): Promise<boolean> {
  if (!canListVaults()) return false;
  const name = vaultDatabaseName(userId);
  return (await indexedDB.databases()).some((database) => database.name === name);
}

export async function readVaultProfile(userId: string): Promise<User | null> {
  if (!(await vaultExists(userId))) return null;
  const db = await openDB<VaultSchema>(vaultDatabaseName(userId));
  try {
    if (!db.objectStoreNames.contains("profile")) return null;
    return (await db.get("profile", PROFILE_KEY))?.row ?? null;
  } finally {
    db.close();
  }
}

// Asking how much is unsent must not migrate anything nor create the database.
export async function countPendingOperations(userId: string): Promise<number> {
  if (!(await vaultExists(userId))) return 0;
  const db = await openDB<VaultSchema>(vaultDatabaseName(userId));
  try {
    if (!db.objectStoreNames.contains("outbox")) return 0;
    return await db.count("outbox");
  } finally {
    db.close();
  }
}
