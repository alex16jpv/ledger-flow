import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  answerBatch,
  applied,
  batchResponse,
  conflictWith,
  operationsOf,
  rejectedWith,
  SERVER_TIME,
} from "@/lib/testing/sync";
import {
  account,
  changes as feedChanges,
  openTestVault,
  profile,
  settlement,
  sharedExpense,
  sharedGroup,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { purgeVault } from "../purge";
import { readAccounts } from "../repository/accounts";
import { setCurrentVault } from "../repository/read";
import { readTransactions } from "../repository/transactions";
import {
  accountRecord,
  type OutboxOperation,
  profileRecord,
  settlementRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { requestSync, resetSyncEngine } from "./engine";
import { pendingOperations, type VaultDb } from "./queue";
import { discardOperation } from "./resolve";
import { createSharedExpense, deleteSettlement, recordSettlement } from "./shared";
import { refreshOutboxStatus, resetOutboxStatus } from "./status";
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";

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
  await resetSyncEngine();
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

const stale = (current: unknown) => {
  answerBatch(fetchMock, () => conflictWith("STALE_UPDATE", current));
};

const row = async (db: VaultDb) => (await db.get("transactions", "t1"))?.row;
const kept = async (db: VaultDb) => (await db.get("transactions", "t1"))?.server;

const feedOf = (rows: Partial<SyncChangesResponse["changes"]>): SyncChangesResponse => ({
  serverTime: T1,
  changes: feedChanges(rows),
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

    answerBatch(fetchMock, () => applied({ ...served, amount: 130, updatedAt: T1 }));
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
    stale(other);
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
    stale({ ...served, updatedAt: T1 });
    reportOnline(true);
    await requestSync();
    expect(await statuses(vault.db)).toEqual(["conflict"]);

    // Offline so the read comes from the mirror, which is where the projection lives.
    reportOnline(false);
    const accounts = await readAccounts();

    expect(accounts[0]?.balance).toBe(1000);
  });

  it("puts a refused write's row back at the server's version, with no pull to help", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateTransaction("t1", { date: "2027-01-01T00:00:00.000Z" });
    // The tab that made the write is gone: the rollback with it, which is what leaves `failed`.
    await resetSyncEngine();
    answerBatch(fetchMock, () => rejectedWith("FUTURE_DATE"));
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
    stale({ ...served, updatedAt: T1 });
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
    // An operation the server did not answer for is never taken for landed, so it stays in line.
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        json({
          serverTime: SERVER_TIME,
          results: operationsOf(init)
            .filter((operation) => operation.action === "update")
            .map((operation) => ({
              opId: operation.opId,
              seq: operation.seq,
              entity: operation.entity,
              id: operation.id,
              status: "applied",
              result: { ...served, amount: 130, updatedAt: T1 },
            })),
        }),
      ),
    );
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
    expect(accounts[0]?.balance).toBe(970);
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
    expect((await readAccounts())[0]?.balance).toBe(995);
  });
});

// T-162: the feed can bring a write the server applied while it is still in line, or sending.
describe("a queued write the feed shows already applied (T-162)", () => {
  const lunch = {
    id: "t2",
    type: "EXPENSE" as const,
    amount: 50,
    date: "2026-09-04T11:00:00.000Z",
    categoryId: "c1",
    fromAccountId: "a1",
    toAccountId: null,
    description: "Coffee",
    tags: [],
    note: null,
  };
  const landed = transaction({ ...lunch, updatedAt: T1 });
  const balance = async () => (await readAccounts())[0]?.balance;

  it("counts a create once when the feed brings its row and the balance that holds it", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(lunch, "t2");
    expect(await balance()).toBe(950);

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({ transactions: [landed], accounts: [{ ...cash, balance: 950, updatedAt: T1 }] }),
        ),
    });

    expect(await statuses(vault.db)).toEqual(["pending"]);
    expect(await balance()).toBe(950);
  });

  it("counts nothing for a create the feed brings already deleted by another device", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(lunch, "t2");

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({
            transactions: [{ ...landed, deletedAt: T1 }],
            accounts: [{ ...cash, updatedAt: T1 }],
          }),
        ),
    });

    expect(await statuses(vault.db)).toEqual(["pending"]);
    expect(await balance()).toBe(1000);
  });

  it("restates an edit queued behind that create from the row the server holds", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(lunch, "t2");
    await updateTransaction("t2", { amount: 80 });
    expect(await balance()).toBe(920);

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({ transactions: [landed], accounts: [{ ...cash, balance: 950, updatedAt: T1 }] }),
        ),
    });

    expect(await balance()).toBe(920);
  });

  it("counts it once when the pull lands while the create is on its way, and after it settles", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(lunch, "t2");
    let midway: number | undefined;
    fetchMock.mockImplementation(async (_input, init) => {
      await pullChanges(vault, {
        fetchPage: () =>
          Promise.resolve(
            feedOf({
              transactions: [landed],
              accounts: [{ ...cash, balance: 950, updatedAt: T1 }],
            }),
          ),
      });
      expect(await statuses(vault.db)).toEqual(["sending"]);
      midway = await balance();
      return batchResponse(init, () => applied(landed));
    });
    reportOnline(true);
    await requestSync();

    expect(midway).toBe(950);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(await balance()).toBe(950);
  });

  it("counts a payment once, and drops the movements it minted for the server's own", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const payment = await recordSettlement({
      groupId: null,
      counterparty: { contactId: "k1", expenseId: null },
      date: "2026-09-04T11:00:00.000Z",
      collected: 600,
      paid: 0,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 0,
    });
    expect(await balance()).toBe(1600);
    const theirs = transaction({
      id: "m-server",
      type: "SETTLEMENT",
      amount: 600,
      categoryId: null,
      fromAccountId: null,
      toAccountId: "a1",
      sharedSettlementId: payment.id,
      updatedAt: T1,
    });

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({
            settlements: [{ ...payment, updatedAt: T1 }],
            transactions: [theirs],
            accounts: [{ ...cash, balance: 1600, updatedAt: T1 }],
          }),
        ),
    });

    expect(await statuses(vault.db)).toEqual(["pending"]);
    expect(await balance()).toBe(1600);
    const movements = (await vault.db.getAll("transactions")).map((record) => record.id);
    expect(movements.sort()).toEqual(["m-server", "t1"]);
  });

  it("counts an undone payment once when the feed already shows it undone", async () => {
    const vault = await vaultWith();
    const theirs = transaction({
      id: "m-server",
      type: "SETTLEMENT",
      amount: 600,
      categoryId: null,
      fromAccountId: null,
      toAccountId: "a1",
      sharedSettlementId: "p1",
    });
    await vault.db.put("accounts", accountRecord({ ...cash, balance: 1600 }));
    await vault.db.put("settlements", settlementRecord(settlement({ collected: 600 })));
    await vault.db.put("transactions", transactionRecord(theirs));
    reportOnline(false);
    await deleteSettlement("p1");
    expect(await balance()).toBe(1000);

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({
            settlements: [settlement({ collected: 600, deletedAt: T1, updatedAt: T1 })],
            transactions: [{ ...theirs, deletedAt: T1, updatedAt: T1 }],
            accounts: [{ ...cash, balance: 1000, updatedAt: T1 }],
          }),
        ),
    });

    expect(await statuses(vault.db)).toEqual(["pending"]);
    expect(await balance()).toBe(1000);
  });

  it("keeps an undone payment's one effect whole while the feed still brings its movements", async () => {
    const vault = await vaultWith();
    const settled = transaction({
      id: "m1",
      type: "SETTLEMENT",
      amount: 600,
      categoryId: null,
      fromAccountId: null,
      toAccountId: "a1",
      sharedSettlementId: "p1",
    });
    const covered = transaction({ id: "m2", amount: 300, sharedSettlementId: "p1" });
    await vault.db.put("accounts", accountRecord({ ...cash, balance: 1300 }));
    await vault.db.put("settlements", settlementRecord(settlement({ collected: 600, paid: 300 })));
    await vault.db.put("transactions", transactionRecord(settled));
    await vault.db.put("transactions", transactionRecord(covered));
    reportOnline(false);
    await deleteSettlement("p1");
    expect(await balance()).toBe(1000);

    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({
            settlements: [settlement({ collected: 600, paid: 300 })],
            transactions: [settled, covered],
            accounts: [{ ...cash, balance: 1300 }],
          }),
        ),
    });

    expect(await balance()).toBe(1000);
  });
});

// T-170: a row only the queue knows about is not the server's, so emptying the copy leaves it there.
describe("what was created here and is still queued, after the copy is emptied (T-170)", () => {
  const coffee = {
    type: "EXPENSE" as const,
    amount: 50,
    date: "2026-09-04T11:00:00.000Z",
    categoryId: "c1",
    fromAccountId: "a1",
    toAccountId: null,
    description: "Coffee",
    tags: [],
    note: null,
  };
  const balance = async () => (await readAccounts())[0]?.balance;
  const resync = async (vault: Awaited<ReturnType<typeof vaultWith>>, rows = {}) => {
    await purgeVault("u1");
    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(
          feedOf({ user: profile(), accounts: [cash], transactions: [served], ...rows }),
        ),
    });
  };

  it("lists a movement created with no network again, as it was, once the resync has run", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    const before = await vault.db.get("transactions", "t2");

    await resync(vault);

    expect(await vault.db.get("transactions", "t2")).toEqual(before);
    expect((await readTransactions({})).data.map((item) => item.id).sort()).toEqual(["t1", "t2"]);
    expect(await balance()).toBe(950);
  });

  it("keeps a create the server refused for good, as the copy did before the resync", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    const [queued] = await pendingOperations(vault.db);
    if (!queued) throw new Error("the create was not queued");
    await vault.db.put("outbox", { ...queued, status: "failed", lastError: "VALIDATION_ERROR" });
    const before = await vault.db.get("transactions", "t2");

    await resync(vault);

    expect(await vault.db.get("transactions", "t2")).toEqual(before);
  });

  it("keeps a payment and the movements it minted, and the balance they move", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const payment = await recordSettlement({
      groupId: null,
      counterparty: { contactId: "k1", expenseId: null },
      date: "2026-09-04T11:00:00.000Z",
      collected: 600,
      paid: 0,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 0,
    });
    const minted = (await vault.db.getAll("transactions")).filter(
      (record) => record.row.sharedSettlementId === payment.id,
    );

    await resync(vault);

    expect((await vault.db.get("settlements", payment.id))?.row).toEqual(payment);
    for (const record of minted) {
      expect(await vault.db.get("transactions", record.id)).toEqual(record);
    }
    expect(minted).toHaveLength(1);
    expect(await balance()).toBe(1600);
  });

  it("keeps no row of the queue once the user discards it with the copy", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");

    await purgeVault("u1", { discardPendingWork: true });

    expect(await vault.db.get("transactions", "t2")).toBeUndefined();
  });

  const lunchSplit = async (vault: Awaited<ReturnType<typeof vaultWith>>) => {
    await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
    reportOnline(false);
    const { split } = sharedExpense({ amount: 100 });
    return createSharedExpense({
      row: {
        id: "e1",
        groupId: "g1",
        description: "Lunch",
        date: served.date,
        amount: 100,
        paidByContactId: null,
        split,
        customSplit: false,
      },
      transactionId: "t1",
    });
  };
  const stamped = { sharedExpenseId: "e1", sharedGroupId: "g1" };
  const unstamped = { sharedExpenseId: null, sharedGroupId: null };
  const movement = async (db: VaultDb) => db.get("transactions", "t1");
  const edited = { ...served, note: "From the other device", updatedAt: T1 };

  it("marks a movement of the server's as split, keeping its server row aside", async () => {
    const vault = await vaultWith();
    await lunchSplit(vault);

    expect(await movement(vault.db)).toMatchObject({ row: stamped, server: served });
  });

  it("keeps the mark through a resync while the expense that takes it is queued", async () => {
    const vault = await vaultWith();
    await lunchSplit(vault);

    await resync(vault, { sharedGroups: [sharedGroup({ id: "g1" })] });

    expect((await vault.db.get("sharedExpenses", "e1"))?.row).toMatchObject({ id: "e1" });
    expect(await movement(vault.db)).toMatchObject({ row: stamped, server: unstamped });
  });

  it("keeps the mark when an ordinary pull brings the movement changed elsewhere", async () => {
    const vault = await vaultWith();
    await lunchSplit(vault);

    await pullChanges(vault, {
      fetchPage: () => Promise.resolve(feedOf({ transactions: [edited] })),
    });

    expect(await movement(vault.db)).toMatchObject({
      row: { ...stamped, note: "From the other device" },
      server: { ...unstamped, updatedAt: T1 },
    });
  });

  it("moves the movement's baseline to the mark once the server takes the expense", async () => {
    const vault = await vaultWith();
    const expense = await lunchSplit(vault);
    await pullChanges(vault, {
      fetchPage: () => Promise.resolve(feedOf({ transactions: [edited] })),
    });

    answerBatch(fetchMock, () => applied({ ...expense, updatedAt: T1 }));
    reportOnline(true);
    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    const record = await movement(vault.db);
    expect(record?.row).toMatchObject(stamped);
    expect(record?.server).toBeUndefined();
  });

  it("takes the mark off when the server refuses the expense for good", async () => {
    const vault = await vaultWith();
    await lunchSplit(vault);

    answerBatch(fetchMock, () => rejectedWith("TRANSACTION_ALREADY_SHARED"));
    reportOnline(true);
    await requestSync();

    expect(await statuses(vault.db)).toEqual(["failed"]);
    expect((await movement(vault.db))?.row).toMatchObject(unstamped);
  });

  it("takes the mark off when the stuck expense is discarded", async () => {
    const vault = await vaultWith();
    await lunchSplit(vault);
    const [queued] = await pendingOperations(vault.db);
    if (!queued) throw new Error("the expense was not queued");
    await vault.db.put("outbox", { ...queued, status: "failed", lastError: "VALIDATION_ERROR" });

    await discardOperation(vault.db, queued.seq);

    expect(await vault.db.get("sharedExpenses", "e1")).toBeUndefined();
    expect(await movement(vault.db)).toMatchObject({ row: unstamped });
  });

  it("gives way to the server's row when the create had landed and its answer was lost", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    const theirs = transaction({ ...coffee, id: "t2", updatedAt: T1 });

    await resync(vault, {
      accounts: [{ ...cash, balance: 950, updatedAt: T1 }],
      transactions: [served, theirs],
    });

    expect((await vault.db.get("transactions", "t2"))?.row).toEqual(theirs);
    expect(await balance()).toBe(950);
  });
});
