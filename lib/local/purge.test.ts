import { purgePersistedCaches } from "@/lib/query/purge";
import { account, openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";

import { countPendingOperations, vaultExists } from "./db";
import { purgeVault } from "./purge";
import { accountRecord, type OutboxOperation, transactionRecord } from "./schema";

function operation(seq: number): OutboxOperation {
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
  };
}

async function fill(userId: string, pending: number): Promise<void> {
  const vault = await openTestVault(userId);
  await vault.db.put("accounts", accountRecord(account({ id: "a1" })));
  await vault.db.put("transactions", transactionRecord(transaction({ id: "t1" })));
  await vault.db.put("meta", { key: "syncCursor", value: "v1|cursor" });
  await vault.db.put("meta", { key: "outboxSeq", value: pending });
  for (let seq = 1; seq <= pending; seq += 1) await vault.db.put("outbox", operation(seq));
  vault.close();
}

describe("purgeVault", () => {
  afterEach(wipeVaults);

  it("clears the mirror and the cursor when nothing is unsent", async () => {
    await fill("u1", 0);

    const outcome = await purgeVault("u1");
    expect(outcome).toEqual({ mirrorCleared: true, operationsDiscarded: 0, operationsKept: 0 });

    const vault = await openTestVault("u1");
    expect(await vault.db.count("accounts")).toBe(0);
    expect(await vault.db.count("transactions")).toBe(0);
    expect(await vault.db.get("meta", "syncCursor")).toBeUndefined();
  });

  it("keeps unsent work by default and says how much it kept", async () => {
    await fill("u1", 12);

    const outcome = await purgeVault("u1");
    expect(outcome).toEqual({ mirrorCleared: true, operationsDiscarded: 0, operationsKept: 12 });

    const vault = await openTestVault("u1");
    expect(await vault.db.count("accounts")).toBe(0);
    expect(await vault.db.count("outbox")).toBe(12);
    expect(await vault.db.get("meta", "outboxSeq")).toEqual({ key: "outboxSeq", value: 12 });
  });

  it("discards unsent work only when the caller confirms it", async () => {
    await fill("u1", 12);

    const outcome = await purgeVault("u1", { discardPendingWork: true });
    expect(outcome).toEqual({ mirrorCleared: true, operationsDiscarded: 12, operationsKept: 0 });

    const vault = await openTestVault("u1");
    expect(await vault.db.count("outbox")).toBe(0);
    expect(await vault.db.get("meta", "outboxSeq")).toBeUndefined();
  });

  it("returns the same user their outbox when they sign back in", async () => {
    await fill("u1", 5);
    await purgeVault("u1");

    const vault = await openTestVault("u1");
    expect(vault.outbox).toBe("current");
    expect(await vault.db.count("outbox")).toBe(5);
    expect(await countPendingOperations("u1")).toBe(5);
  });

  it("touches only the vault of the user it was asked about", async () => {
    await fill("u1", 3);
    await fill("u2", 4);

    await purgeVault("u1", { discardPendingWork: true });

    expect(await countPendingOperations("u1")).toBe(0);
    expect(await countPendingOperations("u2")).toBe(4);
    const other = await openTestVault("u2");
    expect(await other.db.count("accounts")).toBe(1);
  });

  it("does nothing, and creates nothing, for a user with no vault", async () => {
    expect(await purgeVault("ghost")).toEqual({
      mirrorCleared: false,
      operationsDiscarded: 0,
      operationsKept: 0,
    });
    expect(await vaultExists("ghost")).toBe(false);
  });
});

describe("purgePersistedCaches", () => {
  afterEach(wipeVaults);

  it("never takes the vault, and its outbox, with the query caches", async () => {
    await fill("u1", 9);
    const cache = indexedDB.open("lf-cache-u1", 1);
    await new Promise((resolve) => {
      cache.onsuccess = () => {
        cache.result.close();
        resolve(null);
      };
    });

    await purgePersistedCaches();

    const names = (await indexedDB.databases()).map((database) => database.name);
    expect(names).not.toContain("lf-cache-u1");
    expect(names).toContain("lf-vault-u1");
    expect(await countPendingOperations("u1")).toBe(9);
  });
});
