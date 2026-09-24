import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, applied, operationsOf, SERVER_TIME } from "@/lib/testing/sync";
import {
  account,
  openTestVault,
  profile,
  sharedExpense,
  sharedGroup,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { Restamp, SharedSplit } from "@/types/api";

import { keepAddedExpense } from "../repository/joined";
import { setCurrentVault } from "../repository/read";
import {
  accountRecord,
  profileRecord,
  sharedExpenseRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { archiveAccount, setDefaultAccount } from "./accounts";
import { requestSync, resetSyncEngine, setSyncTransport, startSyncEngine } from "./engine";
import { pendingOperations, type VaultDb } from "./queue";
import { saveSharedSplit } from "./shared";
import { resetOutboxStatus } from "./status";
import { createTransaction, updateTransaction } from "./transactions";

const T0 = "2026-08-10T20:00:00.000Z";
const T1 = "2026-09-06T10:00:00.100Z";
const S0 = "2026-08-10T20:00:00.000Z";
const S1 = "2026-09-06T10:00:00.200Z";
const ELSEWHERE = "2026-09-01T00:00:00.000Z";

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const calls = () => fetchMock.mock.calls.map(([input, init]) => `${init?.method} ${urlOf(input)}`);

const ifMatchOf = (init: RequestInit | undefined): string | null =>
  new Headers(init?.headers).get("If-Match");

const halves: SharedSplit = {
  mode: "EQUAL",
  guests: null,
  shares: [
    {
      party: "USER",
      contactId: null,
      percent: null,
      fixedAmount: null,
      amount: 45_000,
      collected: 0,
    },
    {
      party: "CONTACT",
      contactId: "k1",
      percent: null,
      fixedAmount: null,
      amount: 45_000,
      collected: 0,
    },
  ],
};

const movement = (overrides: Parameters<typeof transaction>[0] = {}) =>
  transaction({
    id: "t1",
    amount: 90_000,
    date: T0,
    description: "Cena",
    countsAsYours: 90_000,
    sharedExpenseId: "e1",
    sharedGroupId: "g1",
    updatedAt: T0,
    ...overrides,
  });

const expense = (overrides: Parameters<typeof sharedExpense>[0] = {}) =>
  sharedExpense({
    id: "e1",
    groupId: "g1",
    amount: 90_000,
    split: halves,
    updatedAt: S0,
    ...overrides,
  });

const expenseMoved: Restamp = {
  entity: "sharedExpense",
  id: "e1",
  previousUpdatedAt: S0,
  updatedAt: S1,
};

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

async function inAGroup(rows: { expense?: boolean } = {}) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
  if (rows.expense !== false) await vault.db.put("sharedExpenses", sharedExpenseRecord(expense()));
  await vault.db.put("transactions", transactionRecord(movement()));
  setCurrentVault(vault);
  return vault;
}

// The line of T-145: the amount of a movement in a group, then its split, both with no network.
async function amountThenSplit(): Promise<void> {
  reportOnline(false);
  await updateTransaction("t1", { amount: 60_000 });
  await saveSharedSplit({ id: "e1", groupId: "g1", split: halves, projected: halves });
}

const guardsOf = async (db: VaultDb) =>
  (await pendingOperations(db)).map((op) => `${op.entity}:${op.entityId}@${op.baseUpdatedAt}`);

describe("the rows a write rewrote besides its own (T-145)", () => {
  it("sends the split with the stamp the amount's answer gave its expense, one route at a time", async () => {
    const vault = await inAGroup();
    await amountThenSplit();
    setSyncTransport("routes");
    const guards: (string | null)[] = [];
    fetchMock.mockImplementation((input, init) => {
      guards.push(ifMatchOf(init));
      return Promise.resolve(
        urlOf(input).endsWith("/api/transactions/t1")
          ? json({ ...movement({ amount: 60_000, updatedAt: T1 }), restamped: [expenseMoved] })
          : json({
              ...expense({ amount: 60_000, updatedAt: "2026-09-06T10:00:00.300Z" }),
              restamped: [],
            }),
      );
    });
    reportOnline(true);

    await requestSync();

    expect(calls()).toEqual(["PUT /api/transactions/t1", "PUT /api/shared-groups/g1/expenses/e1"]);
    expect(guards).toEqual([T0, S1]);
    expect(await pendingOperations(vault.db)).toEqual([]);
    // The list rides beside the row, and the mirror keeps the row only.
    expect((await vault.db.get("transactions", "t1"))?.row).not.toHaveProperty("restamped");
    expect((await vault.db.get("sharedExpenses", "e1"))?.row).not.toHaveProperty("restamped");
  });

  it("moves the guard of the split when the amount went in an earlier batch of the pass", async () => {
    const vault = await inAGroup();
    await amountThenSplit();
    const [amount] = await pendingOperations(vault.db);
    if (!amount) throw new Error("the amount was not queued");
    // Heavy enough that the two operations cannot share one batch.
    await vault.db.put("outbox", {
      ...amount,
      payload: {
        ...(amount.payload as object),
        body: { amount: 60_000, note: "x".repeat(900_000) },
      },
    });
    const sentGuards: (string | undefined)[][] = [];
    fetchMock.mockImplementation((_input, init) => {
      const operations = operationsOf(init);
      sentGuards.push(operations.map((op) => op.baseUpdatedAt));
      return Promise.resolve(
        json({
          serverTime: SERVER_TIME,
          results: operations.map((op) => ({
            opId: op.opId,
            seq: op.seq,
            entity: op.entity,
            id: op.id,
            status: "applied",
            ...(op.entity === "transaction"
              ? { result: movement({ amount: 60_000, updatedAt: T1 }), restamped: [expenseMoved] }
              : {}),
          })),
        }),
      );
    });
    reportOnline(true);

    await requestSync();

    expect(sentGuards).toEqual([[T0], [S1]]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("rebases a split queued while the batch was in flight from the stamp the restamp moved it to", async () => {
    const vault = await inAGroup();
    await amountThenSplit();
    const S2 = "2026-09-06T10:00:00.300Z";
    const sentGuards: (string | undefined)[][] = [];
    fetchMock.mockImplementation(async (_input, init) => {
      const operations = operationsOf(init);
      sentGuards.push(operations.map((op) => op.baseUpdatedAt));
      if (sentGuards.length === 1) {
        const split = (await pendingOperations(vault.db)).find(
          (op) => op.entity === "sharedExpense",
        );
        if (!split) throw new Error("the split was not queued");
        await vault.db.put("outbox", {
          ...split,
          seq: 99,
          opId: "00000000-0000-7000-8000-000000000099",
          status: "pending",
        });
      }
      return json({
        serverTime: SERVER_TIME,
        results: operations.map((op) => ({
          opId: op.opId,
          seq: op.seq,
          entity: op.entity,
          id: op.id,
          status: "applied",
          ...(op.entity === "transaction"
            ? { result: movement({ amount: 60_000, updatedAt: T1 }), restamped: [expenseMoved] }
            : { result: expense({ updatedAt: S2 }) }),
        })),
      });
    });
    reportOnline(true);

    await requestSync();

    expect(sentGuards).toEqual([[T0, S0], [S2]]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("guards a split queued after the amount landed with the stamp the mirror took from it", async () => {
    const vault = await inAGroup();
    reportOnline(false);
    await updateTransaction("t1", { amount: 60_000 });
    answerBatch(fetchMock, () => ({
      ...applied(movement({ amount: 60_000, updatedAt: T1 })),
      restamped: [expenseMoved],
    }));
    reportOnline(true);
    await requestSync();

    reportOnline(false);
    await saveSharedSplit({ id: "e1", groupId: "g1", split: halves, projected: halves });

    expect(await guardsOf(vault.db)).toEqual([`sharedExpense:e1@${S1}`]);
    expect((await vault.db.get("sharedExpenses", "e1"))?.updatedAt).toBe(S1);
  });

  it("leaves alone a guard, and a mirror row, that another write already moved", async () => {
    const vault = await inAGroup();
    await vault.db.put("sharedExpenses", sharedExpenseRecord(expense({ updatedAt: ELSEWHERE })));
    await amountThenSplit();
    answerBatch(fetchMock, (op) =>
      op.entity === "transaction"
        ? { ...applied(movement({ amount: 60_000, updatedAt: T1 })), restamped: [expenseMoved] }
        : { status: "blocked", blockedBy: op.opId },
    );
    reportOnline(true);

    await requestSync();

    expect(await guardsOf(vault.db)).toEqual([`sharedExpense:e1@${ELSEWHERE}`]);
    expect((await vault.db.get("sharedExpenses", "e1"))?.updatedAt).toBe(ELSEWHERE);
  });

  it("moves a queued guard the mirror could not project a write for, sent straight to the server", async () => {
    const vault = await inAGroup({ expense: false });
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t2", updatedAt: T0 })));
    reportOnline(false);
    await updateTransaction("t2", { note: "con Ana" });
    const movementMoved: Restamp = {
      entity: "transaction",
      id: "t2",
      previousUpdatedAt: T0,
      updatedAt: T1,
    };
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ ...expense({ updatedAt: S1 }), restamped: [movementMoved] })),
    );
    reportOnline(true);

    const saved = await saveSharedSplit({
      id: "e1",
      groupId: "g1",
      split: halves,
      projected: halves,
    });

    expect(calls()).toEqual(["PUT /api/shared-groups/g1/expenses/e1"]);
    expect(saved).not.toHaveProperty("restamped");
    expect(await guardsOf(vault.db)).toEqual([`transaction:t2@${T1}`]);
  });

  it("tells the pull that follows the round it is news when the mirror took a stamp", async () => {
    await inAGroup();
    reportOnline(false);
    await updateTransaction("t1", { amount: 60_000 });
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    answerBatch(fetchMock, () => ({
      ...applied(movement({ amount: 60_000, updatedAt: T1 })),
      restamped: [expenseMoved],
    }));
    reportOnline(true);

    await requestSync();

    expect(afterRound).toHaveBeenCalledWith(true);
  });

  it("does not when no row the mirror holds was restamped", async () => {
    await inAGroup();
    reportOnline(false);
    await updateTransaction("t1", { amount: 60_000 });
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    answerBatch(fetchMock, () => ({
      ...applied(movement({ amount: 60_000, updatedAt: T1 })),
      restamped: [{ ...expenseMoved, id: "e9" }],
    }));
    reportOnline(true);

    await requestSync();

    expect(afterRound).toHaveBeenCalledWith(false);
  });
});

const A0 = "2026-08-01T00:00:00.000Z";
const A1 = "2026-09-06T10:00:00.400Z";
const SPENT_ID = "11111111-1111-7111-8111-111111111146";

const accountMoved: Restamp = {
  entity: "account",
  id: "a2",
  previousUpdatedAt: A0,
  updatedAt: A1,
};

async function withTwoAccounts() {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  await vault.db.put("accounts", accountRecord(account({ id: "a1", updatedAt: A0 })));
  await vault.db.put(
    "accounts",
    accountRecord(account({ id: "a2", name: "Savings", isDefault: false, updatedAt: A0 })),
  );
  setCurrentVault(vault);
  return vault;
}

// The line of T-146: an expense from an account, then an account write on it, both with no network.
async function spendThen(accountWrite: () => Promise<unknown>): Promise<void> {
  reportOnline(false);
  await createTransaction(
    { type: "EXPENSE", amount: 10_000, date: T0, fromAccountId: "a2" },
    SPENT_ID,
  );
  await accountWrite();
}

const spent = () => transaction({ id: SPENT_ID, fromAccountId: "a2", updatedAt: T1 });

describe("the accounts a movement moved (T-146)", () => {
  it("archives the account with the stamp the movement's answer gave it, one route at a time", async () => {
    const vault = await withTwoAccounts();
    await spendThen(() => archiveAccount("a2"));
    setSyncTransport("routes");
    const guards: (string | null)[] = [];
    fetchMock.mockImplementation((input, init) => {
      guards.push(ifMatchOf(init));
      return Promise.resolve(
        urlOf(input).endsWith("/api/transactions")
          ? json({ ...spent(), restamped: [accountMoved] })
          : json({ message: "Account archived" }),
      );
    });
    reportOnline(true);

    await requestSync();

    expect(calls()).toEqual(["POST /api/transactions", "DELETE /api/accounts/a2"]);
    expect(guards).toEqual([null, A1]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("sets the default with that stamp when the movement went in an earlier batch of the pass", async () => {
    const vault = await withTwoAccounts();
    await spendThen(() => setDefaultAccount("a2"));
    const [create] = await pendingOperations(vault.db);
    if (!create) throw new Error("the movement was not queued");
    // Heavy enough that the two operations cannot share one batch.
    await vault.db.put("outbox", {
      ...create,
      payload: {
        ...(create.payload as object),
        body: { ...(create.payload as { body: object }).body, description: "x".repeat(900_000) },
      },
    });
    const sentGuards: (string | undefined)[][] = [];
    fetchMock.mockImplementation((_input, init) => {
      const operations = operationsOf(init);
      sentGuards.push(operations.map((op) => op.baseUpdatedAt));
      return Promise.resolve(
        json({
          serverTime: SERVER_TIME,
          results: operations.map((op) => ({
            opId: op.opId,
            seq: op.seq,
            entity: op.entity,
            id: op.id,
            status: "applied",
            ...(op.entity === "transaction"
              ? { result: spent(), restamped: [accountMoved] }
              : { result: account({ id: "a2", isDefault: true, updatedAt: SERVER_TIME }) }),
          })),
        }),
      );
    });
    reportOnline(true);

    await requestSync();

    expect(sentGuards).toEqual([[undefined], [A1]]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("moves the mirror's account to the new stamp and tells the pull it is news", async () => {
    const vault = await withTwoAccounts();
    await spendThen(() => Promise.resolve());
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    answerBatch(fetchMock, () => ({ ...applied(spent()), restamped: [accountMoved] }));
    reportOnline(true);

    await requestSync();

    expect((await vault.db.get("accounts", "a2"))?.updatedAt).toBe(A1);
    expect((await vault.db.get("accounts", "a1"))?.updatedAt).toBe(A0);
    expect(afterRound).toHaveBeenCalledWith(true);
  });

  it("archives the account a new default was taken from with the stamp that answer gave it", async () => {
    const vault = await withTwoAccounts();
    reportOnline(false);
    await setDefaultAccount("a2");
    await archiveAccount("a1");
    setSyncTransport("routes");
    const guards: (string | null)[] = [];
    fetchMock.mockImplementation((input, init) => {
      guards.push(ifMatchOf(init));
      return Promise.resolve(
        urlOf(input).endsWith("/api/accounts/a2/default")
          ? json({
              ...account({ id: "a2", isDefault: true, updatedAt: SERVER_TIME }),
              restamped: [{ ...accountMoved, id: "a1" }],
            })
          : json({ message: "Account archived" }),
      );
    });
    reportOnline(true);

    await requestSync();

    expect(calls()).toEqual(["POST /api/accounts/a2/default", "DELETE /api/accounts/a1"]);
    expect(guards).toEqual([A0, A1]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("moves a queued account guard when a line is added to the ledger straight from a group", async () => {
    const vault = await withTwoAccounts();
    reportOnline(false);
    await archiveAccount("a2");
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    const added = transaction({ id: "t9", fromAccountId: "a2", updatedAt: T1 });

    const row = await keepAddedExpense({ ...added, restamped: [accountMoved] });

    expect(row).not.toHaveProperty("restamped");
    expect((await vault.db.get("transactions", "t9"))?.row).not.toHaveProperty("restamped");
    expect(await guardsOf(vault.db)).toEqual([`account:a2@${A1}`]);
    expect(afterRound).toHaveBeenCalledWith(true);
  });
});
