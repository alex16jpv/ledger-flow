import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readAccounts } from "../repository/accounts";
import { setCurrentVault } from "../repository/read";
import { accountRecord, type OutboxOperation, profileRecord, transactionRecord } from "../schema";
import { requestSync, resetSyncEngine } from "./engine";
import { pendingOperations, type VaultDb } from "./queue";
import { discardOperation } from "./resolve";
import { refreshOutboxStatus, resetOutboxStatus } from "./status";
import { deleteTransaction, updateTransaction } from "./transactions";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

const fetchMock = vi.fn<typeof fetch>();
const T0 = "2026-08-01T10:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";
const cash = account({ id: "a1", name: "Cash", balance: 1000, openingBalance: 1000 });
const served = transaction({ id: "t1", amount: 100, description: "Lunch", updatedAt: T0 });

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

// A vault as a pull left it: the profile, one account, one movement the server knows, no queue.
async function vaultWith() {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(cash));
  await vault.db.put("transactions", transactionRecord(served));
  await vault.db.put("meta", { key: "syncedAt", value: T0 });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const stale = (current?: unknown) =>
  json(
    { error: "Conflict", message: "stale", code: "STALE_UPDATE", ...(current ? { current } : {}) },
    { status: 409 },
  );

const row = async (db: VaultDb) => (await db.get("transactions", "t1"))?.row;
const kept = async (db: VaultDb) => (await db.get("transactions", "t1"))?.server;

const feedOf = (rows: Partial<SyncChangesResponse["changes"]>): SyncChangesResponse => ({
  serverTime: T1,
  changes: { user: null, accounts: [], categories: [], transactions: [], budgets: [], ...rows },
  pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "c1" },
});

const statuses = async (db: VaultDb) => (await pendingOperations(db)).map((entry) => entry.status);

// D-24: the mirror keeps, per row, the server's version and what the queue will still send on top.
describe("the row the mirror keeps while its queue is not empty", () => {
  it("keeps the server's row aside from the first queued write, and drops it once the queue is empty", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await updateTransaction("t1", { amount: 130 });

    expect((await row(vault.db))?.amount).toBe(130);
    expect((await kept(vault.db))?.amount).toBe(100);

    fetchMock.mockResolvedValue(json({ ...served, amount: 130, updatedAt: T1 }));
    reportOnline(true);
    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await row(vault.db))?.amount).toBe(130);
    expect(await kept(vault.db)).toBeUndefined();
  });

  it("shows the server's row after a 409 whichever came first, the pull or the drain", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { amount: 130 });
    const other = { ...served, description: "From the other device", updatedAt: T1 };

    // The pull lands first and reprojects the pending edit over the other device's row...
    await pullChanges(vault, {
      fetchPage: () => Promise.resolve(feedOf({ transactions: [other] })),
    });
    expect(await row(vault.db)).toMatchObject({
      amount: 130,
      description: "From the other device",
    });

    // ...then the drain earns the 409: the row goes back to the server's, the edit lives on the op.
    fetchMock.mockResolvedValue(stale(other));
    reportOnline(true);
    await requestSync();

    expect(await statuses(vault.db)).toEqual(["conflict"]);
    expect(await row(vault.db)).toMatchObject({
      amount: 100,
      description: "From the other device",
    });
    expect((await kept(vault.db))?.updatedAt).toBe(T1);
  });

  it("leaves the projected balance where the server has it while the edit is in conflict", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { amount: 130 });
    fetchMock.mockResolvedValue(stale({ ...served, updatedAt: T1 }));
    reportOnline(true);
    await requestSync();
    expect(await statuses(vault.db)).toEqual(["conflict"]);

    // Offline so the read comes from the mirror, which is where the projection lives.
    reportOnline(false);
    const accounts = await readAccounts();

    expect(accounts.data[0]?.balance).toBe(1000);
  });

  it("puts a refused write's row back at the server's version, with no pull to help", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { date: "2027-01-01T00:00:00.000Z" });
    // The tab that made the write is gone: the rollback with it, which is what leaves `failed`.
    resetSyncEngine();
    fetchMock.mockResolvedValue(
      json({ error: "Validation", message: "future", code: "FUTURE_DATE" }, { status: 400 }),
    );
    reportOnline(true);
    await requestSync();

    expect(await statuses(vault.db)).toEqual(["failed"]);
    expect((await row(vault.db))?.date).toBe(served.date);

    await discardOperation(vault.db, 1);

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await row(vault.db))?.date).toBe(served.date);
    expect(await kept(vault.db)).toBeUndefined();
  });

  it("keeps the edit still in line when the one in front of it on the row is discarded", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { amount: 130 });
    await updateTransaction("t1", { description: "Dinner" });
    fetchMock.mockResolvedValue(stale({ ...served, updatedAt: T1 }));
    reportOnline(true);
    await requestSync();
    expect(await statuses(vault.db)).toEqual(["conflict", "pending"]);
    expect(await row(vault.db)).toMatchObject({ amount: 100, description: "Dinner" });

    await discardOperation(vault.db, 1);

    expect(await statuses(vault.db)).toEqual(["pending"]);
    expect(await row(vault.db)).toMatchObject({ amount: 100, description: "Dinner" });
    expect((await kept(vault.db))?.amount).toBe(100);
  });

  it("keeps the second operation of a chain on the row when the first one lands", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { amount: 130 });
    await deleteTransaction("t1");
    let calls = 0;
    fetchMock.mockImplementation(() => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? json({ ...served, amount: 130, updatedAt: T1 })
          : json({ error: "Server", message: "later", code: "INTERNAL" }, { status: 503 }),
      );
    });
    reportOnline(true);
    await requestSync();

    expect(await statuses(vault.db)).toEqual(["pending"]);
    // The answer to the edit is the new baseline; the delete still in line stays projected on it.
    expect(await row(vault.db)).toMatchObject({ amount: 130, deletedAt: expect.any(String) });
    expect(await kept(vault.db)).toMatchObject({ amount: 130, deletedAt: null, updatedAt: T1 });
  });

  it("restates each queued effect from the row the feed brought, so the balance telescopes from the server's figure", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { amount: 130 });
    const [queued] = await pendingOperations(vault.db);
    expect(
      (queued?.payload as { effect: { before: { amount: number } } }).effect.before.amount,
    ).toBe(100);

    // The other device already moved the amount to 120: the server's balance reflects 120.
    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({
            transactions: [{ ...served, amount: 120, updatedAt: T1 }],
            accounts: [{ ...cash, balance: 980 }],
          }),
        ),
    });

    const [restated] = await pendingOperations(vault.db);
    expect(
      (restated?.payload as { effect: { before: { amount: number } } }).effect.before.amount,
    ).toBe(120);
    const accounts = await readAccounts();
    // 980 is the server's after 120 was spent; this device wants 130 spent: ten more.
    expect(accounts.data[0]?.balance).toBe(970);
  });

  it("keeps a create's own effect: there is no server row to restate it from", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await vault.db.put("outbox", {
      seq: 1,
      opId: "op-1",
      opVersion: 1,
      entity: "transaction",
      entityId: "t2",
      action: "create",
      occurredAt: T0,
      payload: {
        body: { id: "t2", amount: 5 },
        effect: { before: null, after: { ...transaction({ id: "t2", amount: 5 }) } },
      },
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    } satisfies OutboxOperation);
    await vault.db.put(
      "transactions",
      transactionRecord(transaction({ id: "t2", amount: 5 }), transaction({ id: "t2", amount: 5 })),
    );

    await pullChanges(vault, {
      fetchPage: () => Promise.resolve(feedOf({ accounts: [{ ...cash, balance: 1000 }] })),
    });

    const [create] = await pendingOperations(vault.db);
    expect((create?.payload as { effect: { before: unknown } }).effect.before).toBeNull();
    expect((await readAccounts()).data[0]?.balance).toBe(995);
  });
});
