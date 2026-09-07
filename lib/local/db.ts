import { type IDBPDatabase, openDB } from "idb";

import { MIRROR_STORES, type OutboxOperation, vaultDatabaseName, type VaultSchema } from "./schema";

export const VAULT_SCHEMA_VERSION = 1;
export const MIRROR_VERSION = 2;
export const OUTBOX_VERSION = 1;

// Returning null means "this operation cannot be carried forward": the vault then blocks the
// outbox upgrade instead of dropping it (invariant 7).
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
  // Which ones, so the tray can show them and the user can throw them away (F-65). Empty unless
  // `outbox` is "blocked".
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

  for (const name of ["accounts", "categories", "budgets"] as const) {
    if (db.objectStoreNames.contains(name)) continue;
    const store = db.createObjectStore(name, { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("archived", "archived");
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
  // The cursor describes rows that are no longer there, so it goes with them: the next pull is a
  // full snapshot. The outbox store is deliberately absent from this transaction.
  await meta.delete("syncCursor");
  await meta.delete("syncedAt");
  await meta.put({ key: "mirrorVersion", value: mirrorVersion });
  await tx.done;
}

// Only ever walks forward, so an operation written by a newer build blocks an older one instead of
// being reinterpreted with fields that build does not know about.
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
  // Called when another tab's upgrade forces this connection shut. Whoever holds the handle has to
  // stop using it: every call on it from here on throws `InvalidStateError` (F-14).
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

export async function vaultExists(userId: string): Promise<boolean> {
  if (!isVaultSupported() || typeof indexedDB.databases !== "function") return false;
  const name = vaultDatabaseName(userId);
  return (await indexedDB.databases()).some((database) => database.name === name);
}

// Reads the queue without opening the vault: asking how much is unsent must never migrate anything,
// and must never create the database as a side effect of the question.
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
