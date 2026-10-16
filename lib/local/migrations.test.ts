import { openDB } from "idb";

import { installFakeLocks } from "@/lib/testing/locks";
import { account, openTestVault, settlement, transaction, wipeVaults } from "@/lib/testing/vault";

import {
  countPendingOperations,
  MIRROR_MIGRATIONS,
  MIRROR_VERSION,
  type MirrorMigration,
  openVault,
  OUTBOX_VERSION,
  type OutboxMigrations,
  VAULT,
  VAULT_SCHEMA_VERSION,
  type VaultDefinition,
  vaultExists,
  VaultOutdatedError,
} from "./db";
import {
  accountRecord,
  MIRROR_STORES,
  type OutboxOperation,
  settlementRecord,
  transactionRecord,
  vaultDatabaseName,
  type VaultSchema,
} from "./schema";

// The mirror version that shipped with T-268: no device can hold queued rows from before it.
const FIRST_CARRIED_MIRROR_VERSION = 5;

const definition = (overrides: Partial<VaultDefinition> = {}): VaultDefinition => ({
  ...VAULT,
  ...overrides,
});

function operation(seq: number, overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    seq,
    opId: `op-${seq}`,
    opVersion: 1,
    entity: "transaction",
    entityId: `t${seq}`,
    action: "create",
    occurredAt: "2026-08-01T10:00:00.000Z",
    payload: { amount: 20.29 },
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

async function seedQueue(userId: string, count: number, opVersion = 1): Promise<void> {
  const vault = await openTestVault(userId, definition({ outboxVersion: opVersion }));
  const tx = vault.db.transaction("outbox", "readwrite");
  for (let seq = 1; seq <= count; seq += 1) {
    await tx.store.put(operation(seq, { opVersion }));
  }
  await tx.done;
}

describe("mirror migrations", () => {
  afterEach(wipeVaults);

  it("bumping the mirror version drops the mirror and the cursor, and asks for a new snapshot", async () => {
    const first = await openTestVault("u1");
    await first.db.put("accounts", accountRecord(account({ id: "a1" })));
    await first.db.put("transactions", transactionRecord(transaction({ id: "t1" })));
    await first.db.put("meta", { key: "syncCursor", value: "v1|cursor" });
    await first.db.put("meta", { key: "syncedAt", value: "2026-08-01T00:00:00.000Z" });
    expect(first.mirrorReset).toBe(true);

    const again = await openTestVault("u1");
    expect(again.mirrorReset).toBe(false);
    expect(await again.db.count("accounts")).toBe(1);
    expect(await again.db.get("meta", "syncCursor")).toBeDefined();

    const upgraded = await openTestVault("u1", definition({ mirrorVersion: MIRROR_VERSION + 1 }));
    expect(upgraded.mirrorReset).toBe(true);
    expect((await upgraded.db.get("meta", "mirrorEpoch"))?.value).toBe(2);
    expect(await upgraded.db.count("accounts")).toBe(0);
    expect(await upgraded.db.count("transactions")).toBe(0);
    expect(await upgraded.db.get("meta", "syncCursor")).toBeUndefined();
    expect(await upgraded.db.get("meta", "syncedAt")).toBeUndefined();
    expect(await upgraded.db.get("meta", "mirrorVersion")).toEqual({
      key: "mirrorVersion",
      value: MIRROR_VERSION + 1,
    });
  });

  it("dropping the mirror never touches the outbox", async () => {
    await seedQueue("u1", 20);
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account({ id: "a1" })));

    const upgraded = await openTestVault("u1", definition({ mirrorVersion: MIRROR_VERSION + 1 }));
    expect(upgraded.mirrorReset).toBe(true);
    expect(await upgraded.db.count("accounts")).toBe(0);
    expect(await upgraded.db.count("outbox")).toBe(20);
  });
});

// T-268: a row a queued create wrote is on no server yet, so the new snapshot cannot bring it back.
describe("the queue's own rows through a mirror version bump", () => {
  afterEach(wipeVaults);

  const stamped =
    (mark: string): MirrorMigration =>
    (_store, record) => ({ ...record, updatedAt: `${record.updatedAt}+${mark}` });

  async function seedUnsent(vaultDefinition: VaultDefinition = VAULT) {
    const vault = await openTestVault("u1", vaultDefinition);
    const rows = {
      server: accountRecord(account({ id: "a-server" })),
      created: accountRecord(account({ id: "a-new", name: "Edited after creating it" })),
      payment: settlementRecord(settlement({ id: "s-new" })),
      minted: transactionRecord(transaction({ id: "m-new", sharedSettlementId: "s-new" })),
    };
    await vault.db.put("accounts", rows.server);
    await vault.db.put("accounts", rows.created);
    await vault.db.put("settlements", rows.payment);
    await vault.db.put("transactions", rows.minted);
    await vault.db.put(
      "outbox",
      operation(1, { entity: "account", entityId: "a-new", status: "conflict" }),
    );
    await vault.db.put(
      "outbox",
      operation(2, { entity: "account", entityId: "a-new", action: "update" }),
    );
    await vault.db.put(
      "outbox",
      operation(3, { entity: "settlement", entityId: "s-new", payload: { minted: ["m-new"] } }),
    );
    vault.close();
    return rows;
  }

  it("keeps what the queue's creates wrote, as they are now, walked through every step", async () => {
    const rows = await seedUnsent();

    const upgraded = await openTestVault(
      "u1",
      definition({
        mirrorVersion: MIRROR_VERSION + 2,
        mirrorMigrations: {
          [MIRROR_VERSION]: stamped("first"),
          [MIRROR_VERSION + 1]: stamped("second"),
        },
      }),
    );

    expect(upgraded.mirrorReset).toBe(true);
    const carried = `${rows.created.updatedAt}+first+second`;
    expect(await upgraded.db.getAll("accounts")).toEqual([{ ...rows.created, updatedAt: carried }]);
    expect(await upgraded.db.getAllKeys("settlements")).toEqual(["s-new"]);
    expect(await upgraded.db.getAllKeys("transactions")).toEqual(["m-new"]);
    expect(await upgraded.db.count("outbox")).toBe(3);
    expect(await upgraded.db.get("meta", "syncCursor")).toBeUndefined();
  });

  it("drops only the row a step cannot carry", async () => {
    await seedUnsent();

    const upgraded = await openTestVault(
      "u1",
      definition({
        mirrorVersion: MIRROR_VERSION + 1,
        mirrorMigrations: {
          [MIRROR_VERSION]: (store, record) => (store === "settlements" ? null : record),
        },
      }),
    );

    expect(await upgraded.db.getAllKeys("accounts")).toEqual(["a-new"]);
    expect(await upgraded.db.count("settlements")).toBe(0);
    expect(await upgraded.db.getAllKeys("transactions")).toEqual(["m-new"]);
  });

  it("keeps nothing when a version on the way has no step", async () => {
    await seedUnsent();

    const upgraded = await openTestVault(
      "u1",
      definition({
        mirrorVersion: MIRROR_VERSION + 2,
        mirrorMigrations: { [MIRROR_VERSION]: stamped("first") },
      }),
    );

    expect(upgraded.mirrorReset).toBe(true);
    expect(await upgraded.db.count("accounts")).toBe(0);
    expect(await upgraded.db.count("settlements")).toBe(0);
    expect(await upgraded.db.count("transactions")).toBe(0);
    expect(await upgraded.db.count("outbox")).toBe(3);
  });

  it("keeps nothing a newer build wrote when a rolled-back one resets the copy", async () => {
    await seedUnsent(definition({ mirrorVersion: MIRROR_VERSION + 1 }));

    const older = await openTestVault("u1", VAULT);

    expect(older.mirrorReset).toBe(true);
    expect(await older.db.count("accounts")).toBe(0);
    expect(await older.db.count("outbox")).toBe(3);
  });

  it("keeps nothing while the queue is blocked: this build cannot say which rows it wrote", async () => {
    await seedUnsent();

    const blocked = await openTestVault(
      "u1",
      definition({
        mirrorVersion: MIRROR_VERSION + 1,
        outboxVersion: OUTBOX_VERSION + 1,
        mirrorMigrations: { [MIRROR_VERSION]: (_store, record) => record },
      }),
    );

    expect(blocked.outbox).toBe("blocked");
    expect(await blocked.db.count("accounts")).toBe(0);
    expect(await blocked.db.count("outbox")).toBe(3);
  });

  it("reads which rows to keep from the queue already migrated", async () => {
    await seedUnsent();

    const upgraded = await openTestVault(
      "u1",
      definition({
        mirrorVersion: MIRROR_VERSION + 1,
        outboxVersion: OUTBOX_VERSION + 1,
        outboxMigrations: {
          [OUTBOX_VERSION]: (op) => ({
            ...op,
            opVersion: OUTBOX_VERSION + 1,
            action: op.entity === "settlement" ? "update" : op.action,
          }),
        },
        mirrorMigrations: { [MIRROR_VERSION]: (_store, record) => record },
      }),
    );

    expect(upgraded.outbox).toBe("migrated");
    expect(await upgraded.db.getAllKeys("accounts")).toEqual(["a-new"]);
    expect(await upgraded.db.count("settlements")).toBe(0);
  });

  it("every mirror version since T-268 has its step, so a bump cannot forget what only the queue holds", () => {
    for (let version = FIRST_CARRIED_MIRROR_VERSION; version < MIRROR_VERSION; version += 1) {
      expect(MIRROR_MIGRATIONS[version], `MIRROR_MIGRATIONS[${String(version)}]`).toBeTypeOf(
        "function",
      );
    }
  });
});

describe("two builds of the app on one copy (T-171)", () => {
  let uninstall: () => void = () => undefined;
  beforeEach(() => {
    uninstall = installFakeLocks();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    uninstall();
    await wipeVaults();
  });

  const newer = definition({ mirrorVersion: MIRROR_VERSION + 1 });

  it("an older build leaves alone a copy a newer tab still holds", async () => {
    const held = await openTestVault("u1", newer);
    await held.db.put("accounts", accountRecord(account({ id: "a1" })));

    await expect(openVault("u1", VAULT)).rejects.toThrow(VaultOutdatedError);

    // Before T-171 the older build reset it, and the newer tab reset it back on its next open.
    expect(await held.db.count("accounts")).toBe(1);
    expect((await held.db.get("meta", "mirrorVersion"))?.value).toBe(MIRROR_VERSION + 1);
  });

  it("an older build resets a newer copy nobody holds, which is what a rolled-back deploy finds", async () => {
    const before = await openTestVault("u1", newer);
    await before.db.put("accounts", accountRecord(account({ id: "a1" })));
    before.close();

    const older = await openTestVault("u1", VAULT);

    expect(older.mirrorReset).toBe(true);
    expect(await older.db.count("accounts")).toBe(0);
    expect((await older.db.get("meta", "mirrorVersion"))?.value).toBe(MIRROR_VERSION);
  });

  it("an older build leaves alone a queue a newer tab still holds", async () => {
    await openTestVault("u1", definition({ outboxVersion: 2 }));

    await expect(openVault("u1", VAULT)).rejects.toThrow(VaultOutdatedError);
  });

  it("a newer schema held by an open tab is outdated, not a failure", async () => {
    await openTestVault("u1", definition({ schemaVersion: VAULT_SCHEMA_VERSION + 1 }));

    await expect(openVault("u1", VAULT)).rejects.toThrow(VaultOutdatedError);
  });

  it("a newer schema nobody holds is still the failure it was", async () => {
    const upgraded = await openTestVault(
      "u1",
      definition({ schemaVersion: VAULT_SCHEMA_VERSION + 1 }),
    );
    upgraded.close();

    await expect(openVault("u1", VAULT)).rejects.toMatchObject({ name: "VersionError" });
  });

  it("an older build leaves a newer copy alone while the newer build waits in the worker", async () => {
    const before = await openTestVault("u1", newer);
    await before.db.put("accounts", accountRecord(account({ id: "a1" })));
    before.close();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration: () => Promise.resolve({ waiting: {}, installing: null }) },
      configurable: true,
    });

    try {
      // Offline, a reset here leaves the user with an empty copy until the newer build fills it again.
      await expect(openVault("u1", VAULT)).rejects.toThrow(VaultOutdatedError);
    } finally {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    const after = await openTestVault("u1", newer);
    expect(await after.db.count("accounts")).toBe(1);
  });

  it("a newer build waits for the older tabs to let the copy go before it resets it", async () => {
    const older = await openTestVault("u1", VAULT);
    await older.db.put("accounts", accountRecord(account({ id: "a1" })));
    let opened = false;

    const upgrading = openVault("u1", newer).then((vault) => {
      opened = true;
      return vault;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(opened).toBe(false);

    older.close();
    const upgraded = await upgrading;
    expect(upgraded.mirrorReset).toBe(true);
    expect(await upgraded.db.count("accounts")).toBe(0);
    upgraded.close();
  });

  it("a newer build does not wait for ever on an older tab that never answers", async () => {
    await openTestVault("u1", VAULT);
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());

    const upgraded = await openTestVault("u1", newer);

    expect(upgraded.mirrorReset).toBe(true);
  });

  it("the same build in another tab is no reason to step aside", async () => {
    await openTestVault("u1", VAULT);

    const again = await openTestVault("u1", VAULT);

    expect(again.mirrorReset).toBe(false);
  });

  it("lets its version go when the copy closes", async () => {
    const vault = await openTestVault("u1", newer);
    vault.close();

    await vi.waitFor(async () => {
      expect((await navigator.locks.query()).held).toEqual([]);
    });
  });
});

describe("schema migrations", () => {
  afterEach(wipeVaults);

  it("carries 20 pending operations through a structural version bump", async () => {
    await seedQueue("u1", 20);

    const next = VAULT_SCHEMA_VERSION + 1;
    const upgraded = await openTestVault("u1", definition({ schemaVersion: next }));
    expect(upgraded.db.version).toBe(next);
    expect(await upgraded.db.count("outbox")).toBe(20);
    const stored = await upgraded.db.getAll("outbox");
    expect(stored.map((op) => op.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(stored.every((op) => op.status === "pending" && op.attempts === 0)).toBe(true);
    expect(await upgraded.db.getFromIndex("outbox", "opId", "op-7")).toEqual(operation(7));
  });

  it("re-creates a store the upgrade finds missing without disturbing the others", async () => {
    // A vault written by a build that had no budgets store: the upgrade adds it, keeps the rest.
    const bare = await openDB<VaultSchema>(vaultDatabaseName("u1"), 1, {
      upgrade(db) {
        db.createObjectStore("outbox", { keyPath: "seq" }).createIndex("opId", "opId", {
          unique: true,
        });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
    await bare.put("outbox", operation(1));
    bare.close();

    const upgraded = await openTestVault("u1", definition({ schemaVersion: VAULT_SCHEMA_VERSION }));
    for (const store of MIRROR_STORES) {
      expect([...upgraded.db.objectStoreNames]).toContain(store);
    }
    expect([...upgraded.db.transaction("sharedExpenses").store.indexNames].sort()).toEqual([
      "deleted",
      "updatedAt",
    ]);
    expect(await upgraded.db.count("outbox")).toBe(1);
  });
});

describe("outbox migrations", () => {
  afterEach(wipeVaults);

  it("migrates 20 pending operations to a new opVersion", async () => {
    await seedQueue("u1", 20);

    const outboxMigrations: OutboxMigrations = {
      1: (op) => ({ ...op, opVersion: 2, action: `v2:${op.action}` }),
    };
    const upgraded = await openTestVault("u1", definition({ outboxVersion: 2, outboxMigrations }));

    expect(upgraded.outbox).toBe("migrated");
    expect(upgraded.blockedOperations).toBe(0);
    const stored = await upgraded.db.getAll("outbox");
    expect(stored).toHaveLength(20);
    expect(stored.every((op) => op.opVersion === 2 && op.action === "v2:create")).toBe(true);
    expect(await upgraded.db.get("meta", "outboxVersion")).toEqual({
      key: "outboxVersion",
      value: 2,
    });
  });

  it("walks an operation through every intermediate version", async () => {
    await seedQueue("u1", 3);

    const outboxMigrations: OutboxMigrations = {
      1: (op) => ({ ...op, opVersion: 2, action: `${op.action}+2` }),
      2: (op) => ({ ...op, opVersion: 3, action: `${op.action}+3` }),
    };
    const upgraded = await openTestVault("u1", definition({ outboxVersion: 3, outboxMigrations }));

    expect(upgraded.outbox).toBe("migrated");
    const stored = await upgraded.db.getAll("outbox");
    expect(stored.every((op) => op.opVersion === 3 && op.action === "create+2+3")).toBe(true);
  });

  it("blocks instead of discarding when one operation cannot be migrated", async () => {
    await seedQueue("u1", 20);

    const outboxMigrations: OutboxMigrations = {
      1: (op) => (op.seq === 13 ? null : { ...op, opVersion: 2 }),
    };
    const blocked = await openTestVault("u1", definition({ outboxVersion: 2, outboxMigrations }));

    expect(blocked.outbox).toBe("blocked");
    expect(blocked.blockedOperations).toBe(1);
    // F-65: which one, so the tray can show it and the user can throw it away.
    expect(blocked.blockedSeqs).toEqual([13]);
    const stored = await blocked.db.getAll("outbox");
    expect(stored).toHaveLength(20);
    expect(stored.every((op) => op.opVersion === 1)).toBe(true);
    expect(await blocked.db.get("meta", "outboxVersion")).toEqual({
      key: "outboxVersion",
      value: 1,
    });
  });

  it("blocks when no migration exists for the stored version", async () => {
    await seedQueue("u1", 4);
    const blocked = await openTestVault("u1", definition({ outboxVersion: 2 }));
    expect(blocked.outbox).toBe("blocked");
    expect(blocked.blockedOperations).toBe(4);
    expect(await blocked.db.count("outbox")).toBe(4);
  });

  it("stays blocked until the queue is drained, then upgrades on its own", async () => {
    await seedQueue("u1", 4);
    const target = definition({ outboxVersion: 2 });

    const blocked = await openTestVault("u1", target);
    expect(blocked.outbox).toBe("blocked");
    await blocked.db.clear("outbox");

    const clean = await openTestVault("u1", target);
    expect(clean.outbox).toBe("current");
    expect(clean.blockedOperations).toBe(0);
    expect(await clean.db.get("meta", "outboxVersion")).toEqual({
      key: "outboxVersion",
      value: 2,
    });
  });

  it("an older build refuses to reinterpret a queue a newer one wrote", async () => {
    await seedQueue("u1", 5, 2);

    const older = await openTestVault("u1", definition({ outboxVersion: 1 }));
    expect(older.outbox).toBe("blocked");
    expect(older.blockedOperations).toBe(5);
    expect(await older.db.count("outbox")).toBe(5);
  });

  it("bumping structure and opVersion together keeps the queue intact", async () => {
    await seedQueue("u1", 20);

    const outboxMigrations: OutboxMigrations = { 1: (op) => ({ ...op, opVersion: 2 }) };
    const upgraded = await openTestVault(
      "u1",
      definition({
        schemaVersion: VAULT_SCHEMA_VERSION + 1,
        mirrorVersion: MIRROR_VERSION + 1,
        outboxVersion: 2,
        outboxMigrations,
      }),
    );

    expect(upgraded.db.version).toBe(VAULT_SCHEMA_VERSION + 1);
    expect(upgraded.mirrorReset).toBe(true);
    expect(upgraded.outbox).toBe("migrated");
    expect(await upgraded.db.count("outbox")).toBe(20);
  });
});

describe("reading the queue without opening the vault", () => {
  afterEach(wipeVaults);

  it("counts what is unsent", async () => {
    await seedQueue("u1", 7);
    expect(await countPendingOperations("u1")).toBe(7);
  });

  it("does not create a vault for a user that has none", async () => {
    expect(await countPendingOperations("ghost")).toBe(0);
    expect(await vaultExists("ghost")).toBe(false);
  });

  it("does not migrate anything", async () => {
    await seedQueue("u1", 3);
    expect(await countPendingOperations("u1")).toBe(3);
    const vault = await openTestVault("u1");
    const stored = await vault.db.getAll("outbox");
    expect(stored.every((op) => op.opVersion === 1)).toBe(true);
  });
});
