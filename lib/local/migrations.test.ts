import { openDB } from "idb";

import { account, openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";

import {
  countPendingOperations,
  type OutboxMigrations,
  VAULT,
  type VaultDefinition,
  vaultExists,
} from "./db";
import {
  accountRecord,
  type OutboxOperation,
  transactionRecord,
  vaultDatabaseName,
  type VaultSchema,
} from "./schema";

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

    const upgraded = await openTestVault("u1", definition({ mirrorVersion: 2 }));
    expect(upgraded.mirrorReset).toBe(true);
    expect(await upgraded.db.count("accounts")).toBe(0);
    expect(await upgraded.db.count("transactions")).toBe(0);
    expect(await upgraded.db.get("meta", "syncCursor")).toBeUndefined();
    expect(await upgraded.db.get("meta", "syncedAt")).toBeUndefined();
    expect(await upgraded.db.get("meta", "mirrorVersion")).toEqual({
      key: "mirrorVersion",
      value: 2,
    });
  });

  it("dropping the mirror never touches the outbox", async () => {
    await seedQueue("u1", 20);
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account({ id: "a1" })));

    const upgraded = await openTestVault("u1", definition({ mirrorVersion: 2 }));
    expect(upgraded.mirrorReset).toBe(true);
    expect(await upgraded.db.count("accounts")).toBe(0);
    expect(await upgraded.db.count("outbox")).toBe(20);
  });
});

describe("schema migrations", () => {
  afterEach(wipeVaults);

  it("carries 20 pending operations through a structural version bump", async () => {
    await seedQueue("u1", 20);

    const upgraded = await openTestVault("u1", definition({ schemaVersion: 2 }));
    expect(upgraded.db.version).toBe(2);
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

    const upgraded = await openTestVault("u1", definition({ schemaVersion: 2 }));
    expect([...upgraded.db.objectStoreNames]).toContain("budgets");
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
      definition({ schemaVersion: 2, mirrorVersion: 2, outboxVersion: 2, outboxMigrations }),
    );

    expect(upgraded.db.version).toBe(2);
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
