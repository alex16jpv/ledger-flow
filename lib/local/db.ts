import {
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames,
  unwrap,
  wrap,
} from "idb";

import { reportError } from "@/lib/observability/reporter";
import type { User } from "@/types/api";

import { forgetLanded } from "./outbox/landed";
import { type CarryRecord, clearMirror } from "./outbox/unsent";
import {
  advanceMirrorEpoch,
  MIRROR_STORES,
  type MirrorRecord,
  type MirrorStore,
  type OutboxOperation,
  PROFILE_KEY,
  VAULT_DB_PREFIX,
  vaultDatabaseName,
  type VaultSchema,
} from "./schema";

export const VAULT_SCHEMA_VERSION = 4;
export const MIRROR_VERSION = 5;
export const OUTBOX_VERSION = 1;

// Invariant 7: null means the operation cannot be carried forward, so the upgrade blocks.
export type OutboxMigration = (operation: OutboxOperation) => OutboxOperation | null;
export type OutboxMigrations = Readonly<Record<number, OutboxMigration>>;

export const OUTBOX_MIGRATIONS: OutboxMigrations = {};

// T-268: carries a row only the queue holds from one mirror version to the next; null drops it.
export type MirrorMigration = CarryRecord;
export type MirrorMigrations = Readonly<Record<number, MirrorMigration>>;

export const MIRROR_MIGRATIONS: MirrorMigrations = {};

export interface VaultDefinition {
  schemaVersion: number;
  mirrorVersion: number;
  outboxVersion: number;
  outboxMigrations: OutboxMigrations;
  mirrorMigrations: MirrorMigrations;
}

export const VAULT: VaultDefinition = {
  schemaVersion: VAULT_SCHEMA_VERSION,
  mirrorVersion: MIRROR_VERSION,
  outboxVersion: OUTBOX_VERSION,
  outboxMigrations: OUTBOX_MIGRATIONS,
  mirrorMigrations: MIRROR_MIGRATIONS,
};

export type VaultVersions = Pick<
  VaultDefinition,
  "schemaVersion" | "mirrorVersion" | "outboxVersion"
>;

export function isNewerVault(versions: VaultVersions, than: VaultVersions): boolean {
  return (
    versions.schemaVersion > than.schemaVersion ||
    versions.mirrorVersion > than.mirrorVersion ||
    versions.outboxVersion > than.outboxVersion
  );
}

export type OutboxState = "current" | "migrated" | "blocked";

export interface VaultHandle {
  db: IDBPDatabase<VaultSchema>;
  userId: string;
  // This open made the database: nothing had it, or another tab had just deleted it.
  created: boolean;
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

export class VaultOutdatedError extends Error {
  constructor(cause?: unknown) {
    super("The offline copy belongs to a newer version of the app open in another tab", { cause });
    this.name = "VaultOutdatedError";
  }
}

export function isVaultSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

type UpgradeTransaction = IDBPTransaction<
  VaultSchema,
  ArrayLike<StoreNames<VaultSchema>>,
  "versionchange"
>;

function createStores(db: IDBPDatabase<VaultSchema>, upgrade: UpgradeTransaction): void {
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
  }

  if (!db.objectStoreNames.contains("settlements")) {
    const store = db.createObjectStore("settlements", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("deleted", "deleted");
  }

  for (const name of ["invitationsSent", "invitationsReceived"] as const) {
    if (db.objectStoreNames.contains(name)) continue;
    db.createObjectStore(name, { keyPath: "id" }).createIndex("updatedAt", "updatedAt");
  }

  if (!db.objectStoreNames.contains("joinedGroups")) {
    db.createObjectStore("joinedGroups", { keyPath: "id" }).createIndex("updatedAt", "updatedAt");
  }

  if (!db.objectStoreNames.contains("joinedExpenses")) {
    const store = db.createObjectStore("joinedExpenses", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("groupId", "groupId");
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

  const transactions = upgrade.objectStore("transactions");
  if (!transactions.indexNames.contains("addedFrom")) {
    transactions.createIndex("addedFrom", "addedFrom");
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

// Only walks forward, like the queue: a row a newer build wrote is never reinterpreted.
function migrateRecord(
  store: MirrorStore,
  record: MirrorRecord<unknown>,
  from: number,
  target: number,
  migrations: MirrorMigrations,
): MirrorRecord<unknown> | null {
  if (from > target) return null;
  let current: MirrorRecord<unknown> | null = record;
  for (let version = from; current && version < target; version += 1) {
    const step: MirrorMigration | undefined = migrations[version];
    current = step ? step(store, current) : null;
  }
  return current;
}

async function resetMirror(
  db: IDBPDatabase<VaultSchema>,
  stored: number | null,
  definition: VaultDefinition,
  outbox: OutboxState,
): Promise<void> {
  const tx = db.transaction([...MIRROR_STORES, "outbox", "meta"], "readwrite");
  // The outbox is only read: a queue this build cannot read cannot say which rows it wrote.
  const queued = outbox === "blocked" ? [] : await tx.objectStore("outbox").getAll();
  await clearMirror(tx, queued, MIRROR_STORES, (store, record) =>
    stored === null
      ? null
      : migrateRecord(store, record, stored, definition.mirrorVersion, definition.mirrorMigrations),
  );
  const meta = tx.objectStore("meta");
  await meta.delete("syncCursor");
  await meta.delete("syncedAt");
  await forgetLanded(meta);
  await advanceMirrorEpoch(meta);
  await meta.put({ key: "mirrorVersion", value: definition.mirrorVersion });
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

const VAULT_LOCK_PREFIX = "lf-vault-";

function vaultLockName(userId: string, versions: VaultVersions): string {
  return `${VAULT_LOCK_PREFIX}${userId}:${String(versions.schemaVersion)}.${String(versions.mirrorVersion)}.${String(versions.outboxVersion)}`;
}

function vaultLocks(): LockManager | undefined {
  return typeof navigator !== "undefined" ? navigator.locks : undefined;
}

async function holdVaultLock(userId: string, versions: VaultVersions): Promise<() => void> {
  const locks = vaultLocks();
  if (!locks) return () => undefined;
  return new Promise((granted) => {
    locks
      .request(vaultLockName(userId, versions), { mode: "shared" }, () => {
        return new Promise<void>((release) => {
          granted(release);
        });
      })
      .catch((error: unknown) => {
        reportError(error, "vault");
        granted(() => undefined);
      });
  });
}

interface HeldVault {
  name: string;
  versions: VaultVersions;
}

async function heldVaults(userId: string): Promise<HeldVault[]> {
  const locks = vaultLocks();
  if (!locks) return [];
  const prefix = `${VAULT_LOCK_PREFIX}${userId}:`;
  const { held = [] } = await locks.query();
  return held.flatMap(({ name }) => {
    if (!name?.startsWith(prefix)) return [];
    const [schemaVersion = 0, mirrorVersion = 0, outboxVersion = 0] = name
      .slice(prefix.length)
      .split(".")
      .map(Number);
    return [{ name, versions: { schemaVersion, mirrorVersion, outboxVersion } }];
  });
}

async function newBuildWaiting(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  return Boolean(registration?.waiting ?? registration?.installing);
}

async function newerBuildAround(userId: string, versions: VaultVersions): Promise<boolean> {
  const held = await heldVaults(userId);
  if (held.some((vault) => isNewerVault(vault.versions, versions))) return true;
  return newBuildWaiting();
}

export const OLDER_TABS_PATIENCE_MS = 3_000;

// A frozen tab only hears `vault:opening` when it wakes, and the copy cannot wait for that.
async function olderBuildsLetGo(userId: string, versions: VaultVersions): Promise<void> {
  const locks = vaultLocks();
  if (!locks) return;
  const older = new Set(
    (await heldVaults(userId))
      .filter((vault) => isNewerVault(versions, vault.versions))
      .map((vault) => vault.name),
  );
  await Promise.all(
    [...older].map((name) =>
      locks
        .request(
          name,
          { mode: "exclusive", signal: AbortSignal.timeout(OLDER_TABS_PATIENCE_MS) },
          () => undefined,
        )
        .catch(() => undefined),
    ),
  );
}

export interface OpenVaultOptions {
  // F-14, T-267: once another tab's upgrade or the browser closes this handle, every call throws `InvalidStateError`.
  onClosed?: () => void;
  // T-166: another tab deleted the database; opening it again would create it empty and refill it.
  onDeleted?: () => void;
}

// idb rejects every transaction's `done` even when nobody awaits it; the request that failed already carries the error.
function observeDone(db: IDBPDatabase<VaultSchema>): void {
  const native = unwrap(db);
  const open = native.transaction.bind(native);
  native.transaction = (...args: Parameters<IDBDatabase["transaction"]>) => {
    const tx = open(...args);
    wrap(tx).done.catch(() => undefined);
    return tx;
  };
}

async function openDatabase(
  userId: string,
  definition: VaultDefinition,
  options: OpenVaultOptions,
  releaseLock: () => void,
): Promise<{ db: IDBPDatabase<VaultSchema>; created: boolean }> {
  let created = false;
  try {
    const db = await openDB<VaultSchema>(vaultDatabaseName(userId), definition.schemaVersion, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        created = oldVersion === 0;
        createStores(database, transaction);
      },
      blocking(_currentVersion, blockedVersion, event) {
        // Another tab is upgrading or deleting the vault; holding this connection open would stall it forever.
        (event.target as IDBDatabase | null)?.close();
        releaseLock();
        if (blockedVersion === null) options.onDeleted?.();
        else options.onClosed?.();
      },
      terminated() {
        releaseLock();
        options.onClosed?.();
      },
    });
    return { db, created };
  } catch (error) {
    if (error instanceof DOMException && error.name === "VersionError") {
      if (await newerBuildAround(userId, definition)) throw new VaultOutdatedError(error);
    }
    throw error;
  }
}

export async function openVault(
  userId: string,
  definition: VaultDefinition = VAULT,
  options: OpenVaultOptions = {},
): Promise<VaultHandle> {
  if (!isVaultSupported()) throw new VaultUnavailableError();

  // Held before opening, so a tab this open's upgrade closes already finds it when it reopens.
  const releaseLock = await holdVaultLock(userId, definition);
  let db: IDBPDatabase<VaultSchema> | null = null;
  try {
    const opened = await openDatabase(userId, definition, options, releaseLock);
    db = opened.db;
    observeDone(db);

    const storedMirrorVersion = await readMetaNumber(db, "mirrorVersion");
    const stored: VaultVersions = {
      schemaVersion: definition.schemaVersion,
      mirrorVersion: storedMirrorVersion ?? 0,
      outboxVersion: (await readMetaNumber(db, "outboxVersion")) ?? 0,
    };
    if (isNewerVault(stored, definition) && (await newerBuildAround(userId, definition))) {
      throw new VaultOutdatedError();
    }
    if (isNewerVault(definition, stored)) await olderBuildsLetGo(userId, definition);

    await db.put("meta", { key: "userId", value: userId });

    const outbox = await upgradeOutbox(db, definition);

    const mirrorReset = storedMirrorVersion !== definition.mirrorVersion;
    if (mirrorReset) await resetMirror(db, storedMirrorVersion, definition, outbox.state);

    const database = db;
    return {
      db: database,
      userId,
      created: opened.created,
      mirrorReset,
      outbox: outbox.state,
      blockedOperations: outbox.blocked.length,
      blockedSeqs: outbox.blocked,
      close: () => {
        database.close();
        releaseLock();
      },
    };
  } catch (error) {
    db?.close();
    releaseLock();
    throw error;
  }
}

export const WIPE_PATIENCE_MS = 10_000;

export class WipeIncompleteError extends Error {
  constructor(database: string, cause?: unknown) {
    super(`The offline copy ${database} could not be deleted`, { cause });
    this.name = "WipeIncompleteError";
  }
}

export function dropDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let patience: ReturnType<typeof setTimeout> | undefined;
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      clearTimeout(patience);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(patience);
      reject(new WipeIncompleteError(name, request.error));
    };
    // A connection that ignores `versionchange` holds the delete back for as long as it stays open.
    request.onblocked = () => {
      patience ??= setTimeout(() => {
        reject(new WipeIncompleteError(name, "blocked by an open connection"));
      }, WIPE_PATIENCE_MS);
    };
  });
}

export function dropVault(userId: string): Promise<void> {
  return dropDatabase(vaultDatabaseName(userId));
}

// D-20: Firefox has no `indexedDB.databases()`, and reading the no as a loss invents one.
export function canListVaults(): boolean {
  return isVaultSupported() && typeof indexedDB.databases === "function";
}

export async function otherVaultUsers(userId: string | undefined): Promise<string[]> {
  if (!canListVaults()) return [];
  return (await indexedDB.databases())
    .map((database) => database.name)
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name.startsWith(VAULT_DB_PREFIX) &&
        (userId === undefined || name !== vaultDatabaseName(userId)),
    )
    .map((name) => name.slice(VAULT_DB_PREFIX.length));
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
export async function countPendingElsewhere(userId: string | undefined): Promise<number> {
  const counts = await Promise.all((await otherVaultUsers(userId)).map(countPendingOperations));
  return counts.reduce((sum, count) => sum + count, 0);
}

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
