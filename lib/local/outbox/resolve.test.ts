import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";

import { setCurrentVault } from "../repository/read";
import { accountRecord, type OutboxOperation, profileRecord, transactionRecord } from "../schema";
import { resetSyncEngine, startSyncEngine } from "./engine";
import { pendingOperations, type VaultDb } from "./queue";
import { discardOperation, operationsNeedingAttention, retryOperation } from "./resolve";
import { outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

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

  it("leaves the mirror alone when the server did not say what it has", async () => {
    const vault = await vaultWithQueue([{}]);

    await discardOperation(vault.db, 1);

    expect(await pendingOperations(vault.db)).toEqual([]);
    // Nothing to put back: the next pull is what corrects the row.
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(15);
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
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(transaction({ id: "t1", amount: 15, updatedAt: "2026-09-04T13:00:00.000Z" })),
      ),
    );
    reportOnline(true);

    await retryOperation(vault.db, 1);

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("if-match")).toBe(T1);
    expect(await pendingOperations(vault.db)).toEqual([]);
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
