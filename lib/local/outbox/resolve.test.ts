import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, applied, operationsOf } from "@/lib/testing/sync";
import { account, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";

import { setCurrentVault } from "../repository/read";
import { accountRecord, type OutboxOperation, profileRecord, transactionRecord } from "../schema";
import { resetSyncEngine, startSyncEngine } from "./engine";
import { pendingOperations, type VaultDb } from "./queue";
import {
  discardImpact,
  discardOperation,
  discardOperations,
  operationsNeedingAttention,
  restoreArchivedAccount,
  retryOperation,
  retryOperations,
} from "./resolve";
import { outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";

const fetchMock = vi.fn<typeof fetch>();
const T0 = "2026-08-01T00:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  resetSyncEngine();
  resetOutboxStatus();
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

async function vaultWithQueue(operations: Partial<OutboxOperation>[]) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(account({ id: "a1" })));
  // The mirror as an offline edit left it: the amount the user typed, not the server's.
  await vault.db.put(
    "transactions",
    transactionRecord(transaction({ id: "t1", amount: 15, updatedAt: T0 })),
  );
  let seq = 0;
  for (const overrides of operations) {
    seq += 1;
    await vault.db.put("outbox", {
      seq,
      opId: `op-${seq}`,
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "update",
      occurredAt: "2026-09-04T10:00:00.000Z",
      payload: { body: { amount: 15 } },
      dependsOn: [],
      status: "conflict",
      attempts: 1,
      lastError: "STALE_UPDATE",
      baseUpdatedAt: T0,
      ...overrides,
    });
  }
  await vault.db.put("meta", { key: "outboxSeq", value: seq });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const statuses = async (db: VaultDb) =>
  (await pendingOperations(db)).map((entry) => `${entry.seq}:${entry.status}`);

describe("resolving a conflict", () => {
  it("discards the operation and puts the server's row back in the mirror", async () => {
    const server = transaction({ id: "t1", amount: 42, updatedAt: T1 });
    const vault = await vaultWithQueue([{ serverRow: server }]);

    expect(await discardOperation(vault.db, 1)).toEqual({ discarded: 1 });

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(42);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outboxStatusStore.getSnapshot().attention).toBe(0);
  });

  it("puts the row back at the baseline the mirror kept when the server did not say what it has", async () => {
    const vault = await vaultWithQueue([{ status: "failed", lastError: "FUTURE_DATE" }]);
    await vault.db.put(
      "transactions",
      transactionRecord(
        transaction({ id: "t1", amount: 15, updatedAt: T0 }),
        transaction({ id: "t1", amount: 10, updatedAt: T0 }),
      ),
    );

    await discardOperation(vault.db, 1);

    expect(await pendingOperations(vault.db)).toEqual([]);
    // No pull would bring this row back — its stamp never moved — so the baseline is the way out.
    const record = await vault.db.get("transactions", "t1");
    expect(record?.row.amount).toBe(10);
    expect(record?.server).toBeUndefined();
  });

  it("resolves only what is still stuck: an operation put back in line elsewhere is not discarded", async () => {
    const vault = await vaultWithQueue([{ status: "pending" }, { seq: 2, status: "conflict" }]);

    expect(await discardImpact(vault.db, [1, 2])).toBe(1);
    expect(await discardOperations(vault.db, [1, 2])).toEqual({ discarded: 1 });
    expect(await statuses(vault.db)).toEqual(["1:pending"]);
  });

  it("takes with it what could never reach the server without it", async () => {
    const vault = await vaultWithQueue([
      { seq: 1, entity: "account", entityId: "a2", action: "create", status: "failed" },
      { seq: 2, entityId: "t2", dependsOn: ["a2"], status: "pending" },
      { seq: 3, entityId: "t3", status: "pending" },
    ]);

    expect(await discardOperation(vault.db, 1)).toEqual({ discarded: 2 });

    expect(await statuses(vault.db)).toEqual(["3:pending"]);
    expect(await vault.db.get("accounts", "a2")).toBeUndefined();
  });

  it("puts the operation back in line guarded by the stamp the server answered with", async () => {
    const server = transaction({ id: "t1", amount: 42, updatedAt: T1 });
    const vault = await vaultWithQueue([{ serverRow: server }]);
    startSyncEngine();
    reportOnline(false);

    await retryOperation(vault.db, 1);

    const [queued] = await pendingOperations(vault.db);
    expect(queued).toMatchObject({
      status: "pending",
      baseUpdatedAt: T1,
      attempts: 0,
      lastError: null,
    });
    expect(queued?.serverRow).toBeUndefined();
  });

  it("sends the retry with the new guard as soon as there is network", async () => {
    const server = transaction({ id: "t1", amount: 42, updatedAt: T1 });
    const vault = await vaultWithQueue([{ serverRow: server }]);
    startSyncEngine();
    answerBatch(fetchMock, () =>
      applied(transaction({ id: "t1", amount: 15, updatedAt: "2026-09-04T13:00:00.000Z" })),
    );
    reportOnline(true);

    await retryOperation(vault.db, 1);

    expect(operationsOf(fetchMock.mock.calls[0]?.[1])[0]?.baseUpdatedAt).toBe(T1);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("counts what a discard would take before anything is deleted", async () => {
    const vault = await vaultWithQueue([
      { seq: 1, entity: "account", entityId: "a2", action: "create", status: "failed" },
      { seq: 2, entityId: "t2", dependsOn: ["a2"], status: "pending" },
      { seq: 3, entityId: "t3", status: "conflict" },
    ]);

    expect(await discardImpact(vault.db, [1])).toBe(2);
    expect(await discardImpact(vault.db, [1, 3])).toBe(3);
    expect(await discardImpact(vault.db, [99])).toBe(0);
    // Counting changes nothing: the tray asks first and discards after the user says so.
    expect(await statuses(vault.db)).toEqual(["1:failed", "2:pending", "3:conflict"]);
  });

  it("discards the whole tray in one transaction, cascades included", async () => {
    const vault = await vaultWithQueue([
      { seq: 1, entity: "account", entityId: "a2", action: "create", status: "failed" },
      { seq: 2, entityId: "t2", dependsOn: ["a2"], status: "pending" },
      { seq: 3, entityId: "t3", status: "conflict" },
      { seq: 4, entityId: "t4", status: "pending" },
    ]);

    expect(await discardOperations(vault.db, [1, 3])).toEqual({ discarded: 3 });

    expect(await statuses(vault.db)).toEqual(["4:pending"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts every stuck operation back in line with its own guard", async () => {
    const vault = await vaultWithQueue([
      { seq: 1, serverRow: transaction({ id: "t1", updatedAt: T1 }) },
      { seq: 2, entityId: "t2", serverRow: transaction({ id: "t2", updatedAt: T0 }) },
      { seq: 3, entityId: "t3", status: "failed", lastError: "RESOURCE_ARCHIVED" },
    ]);
    startSyncEngine();
    reportOnline(false);

    await retryOperations(vault.db, [1, 2, 3]);

    const queue = await pendingOperations(vault.db);
    expect(queue.map((entry) => entry.status)).toEqual(["pending", "pending", "pending"]);
    // Each takes the stamp its own 409 answered with; the refusal that carried none keeps its own.
    expect(queue.map((entry) => entry.baseUpdatedAt)).toEqual([T1, T0, T0]);
    expect(queue.map((entry) => entry.attempts)).toEqual([0, 0, 0]);
    expect(outboxStatusStore.getSnapshot().attention).toBe(0);
  });

  it("lists conflicts and definitive refusals alike, in queue order", async () => {
    const vault = await vaultWithQueue([
      { seq: 1, status: "pending" },
      { seq: 2, status: "failed", lastError: "RESOURCE_ARCHIVED" },
      { seq: 3, status: "conflict" },
    ]);

    expect((await operationsNeedingAttention(vault.db)).map((entry) => entry.seq)).toEqual([2, 3]);
    expect(outboxStatusStore.getSnapshot().attention).toBe(2);
    expect(outboxStatusStore.getSnapshot().firstAttention).toBe(2);
  });
});

describe("the way out of a movement whose account was archived online (F-58)", () => {
  const archived = account({ id: "a1", archivedAt: "2026-09-05T00:00:00.000Z", updatedAt: T1 });

  async function vaultWithArchived() {
    const vault = await vaultWithQueue([
      {
        action: "create",
        payload: { body: { id: "t1", amount: 15, fromAccountId: "a1" } },
        lastError: "RESOURCE_ARCHIVED",
        archivedId: "a1",
      },
    ]);
    await vault.db.put("accounts", accountRecord(archived));
    return vault;
  }

  it("queues the restore ahead of the movement, so the two travel in one batch", async () => {
    const vault = await vaultWithArchived();
    startSyncEngine();
    answerBatch(fetchMock, (op) =>
      applied(
        op.entity === "account" ? account({ id: "a1", updatedAt: T1 }) : transaction({ id: "t1" }),
      ),
    );
    reportOnline(true);

    expect(await restoreArchivedAccount(vault.db, 1)).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = operationsOf(fetchMock.mock.calls[0]?.[1]);
    expect(sent.map((op) => `${op.entity}:${op.action}`)).toEqual([
      "account:restore",
      "transaction:create",
    ]);
    // The movement names the account, so a restore that does not land answers `blocked` instead of
    // the same refusal (D-30).
    expect(sent[1]?.dependsOn).toEqual(["a1"]);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("accounts", "a1"))?.row.archivedAt).toBeNull();
  });

  it("keeps the movement in the tray when the restore does not land", async () => {
    const vault = await vaultWithArchived();
    startSyncEngine();
    answerBatch(fetchMock, (op) =>
      op.entity === "account"
        ? { status: "rejected", code: "VALIDATION", message: "no" }
        : { status: "blocked", blockedBy: operationsOf(fetchMock.mock.calls[0]?.[1])[0]?.opId },
    );
    reportOnline(true);

    await restoreArchivedAccount(vault.db, 1);

    // Nothing was half-applied: the restore is in the tray, the movement is still in line.
    expect(await statuses(vault.db)).toEqual(["0.5:failed", "1:pending"]);
  });

  it("says so when the mirror no longer holds the account", async () => {
    const vault = await vaultWithArchived();
    await vault.db.delete("accounts", "a1");

    expect(await restoreArchivedAccount(vault.db, 1)).toBe(false);

    expect(await statuses(vault.db)).toEqual(["1:conflict"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not touch an operation stuck on anything else", async () => {
    const vault = await vaultWithQueue([{ lastError: "STALE_UPDATE" }]);

    expect(await restoreArchivedAccount(vault.db, 1)).toBe(false);

    expect(await statuses(vault.db)).toEqual(["1:conflict"]);
  });
});
