import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";
import type { Account } from "@/types/api";

import { setCurrentVault } from "../repository/read";
import { accountRecord, type OutboxOperation, profileRecord, transactionRecord } from "../schema";
import { createAccount, updateAccount } from "./accounts";
import {
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  backoffDelay,
  requestSync,
  resetSyncEngine,
  startSyncEngine,
} from "./engine";
import { operationPayload } from "./envelope";
import { pendingOperations, type VaultDb } from "./queue";
import { outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";
import {
  batchUpdateTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./transactions";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });

const fetchMock = vi.fn<typeof fetch>();
const cash = account({ id: "a1", name: "Cash", balance: 1000, openingBalance: 1000 });

const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const calls = () => fetchMock.mock.calls.map(([input, init]) => `${init?.method} ${urlOf(input)}`);

// `api` always serialises the body before it gets here, so the string is the request as sent.
const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === "string" ? init.body : "{}";

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

async function vaultWith(rows: { accounts?: Account[] } = {}) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  for (const row of rows.accounts ?? [cash]) await vault.db.put("accounts", accountRecord(row));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

// The queue as a reload leaves it: rows in the mirror, operations in the outbox, no closure alive.
async function seed(db: VaultDb, operations: Partial<OutboxOperation>[]): Promise<void> {
  let seq = 0;
  for (const overrides of operations) {
    seq += 1;
    await db.put("outbox", {
      seq,
      opId: `op-${seq}`,
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "update",
      occurredAt: "2026-09-04T10:00:00.000Z",
      payload: {},
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
      ...overrides,
    });
  }
  await db.put("meta", { key: "outboxSeq", value: seq });
  await refreshOutboxStatus(db);
}

describe("the sync engine", () => {
  it("runs one drain however many triggers arrive at once", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await updateAccount("a1", { name: "Renamed" });
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(account({ id: "a1", name: "Renamed" }))),
    );
    reportOnline(true);

    const reports = await Promise.all([
      requestSync(),
      requestSync(),
      requestSync(),
      requestSync(),
      requestSync(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(reports).size).toBe(1);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("sends in seq order and stops at the first request that never arrived, dropping nothing", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1" },
      { seq: 2, entityId: "t2" },
      { seq: 3, entityId: "t3" },
    ]);
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json(transaction({ id: "t1" }))))
      .mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")));

    await requestSync();

    expect(calls()).toEqual(["PUT /api/transactions/t1", "PUT /api/transactions/t2"]);
    expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([2, 3]);
    expect((await pendingOperations(vault.db))[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "NETWORK",
    });
  });

  it("holds only what depended on the operation that failed, and lets the rest through", async () => {
    const vault = await vaultWith();
    await vault.db.put("categories", {
      id: "c1",
      row: {
        id: "c1",
        name: "Dining",
        icon: null,
        color: "ORANGE",
        type: "EXPENSE",
        userId: profile().id,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      updatedAt: "2026-08-01T00:00:00.000Z",
      archived: 0,
    });
    await seed(vault.db, [
      {
        seq: 1,
        entity: "account",
        entityId: "a9",
        action: "create",
        payload: { body: { id: "a9" } },
      },
      { seq: 2, entity: "transaction", entityId: "t1", dependsOn: ["a9"] },
      {
        seq: 3,
        entity: "category",
        entityId: "c1",
        action: "update",
        payload: { body: { name: "Food" } },
      },
    ]);
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).includes("/accounts")
          ? json({ code: "VALIDATION", message: "no" }, { status: 400 })
          : json({ id: "c1", name: "Food" }),
      ),
    );

    await requestSync();

    expect(calls()).toEqual(["POST /api/accounts", "PUT /api/categories/c1"]);
    const left = await pendingOperations(vault.db);
    expect(left.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(left[0]?.status).toBe("failed");
    expect(left[1]?.status).toBe("pending");
  });

  it("takes the amber off the figures the moment the queue is empty", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(
      { type: "EXPENSE", amount: 5, date: "2026-09-04T10:00:00.000Z", fromAccountId: "a1" },
      "11111111-1111-7111-8111-111111111111",
    );
    expect(outboxStatusStore.getSnapshot().projected.balances).toBe(true);

    fetchMock.mockImplementation(() =>
      Promise.resolve(json(transaction({ id: "11111111-1111-7111-8111-111111111111" }))),
    );
    reportOnline(true);
    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(outboxStatusStore.getSnapshot()).toEqual({
      pending: 0,
      conflicts: 0,
      projected: { balances: false, spending: false, budgets: false },
    });
  });

  it("pulls after a push, and only after one that reached the server", async () => {
    const vault = await vaultWith();
    const afterPush = vi.fn();
    startSyncEngine({ afterPush });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(() => Promise.resolve(json(transaction({ id: "t1" }))));

    await requestSync();
    expect(afterPush).toHaveBeenCalledTimes(1);

    await requestSync();
    expect(afterPush).toHaveBeenCalledTimes(1);
  });

  it("drains when the network comes back and when the window regains focus", async () => {
    const vault = await vaultWith();
    startSyncEngine();
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(() => Promise.resolve(json(transaction({ id: "t1" }))));

    reportOnline(false);
    reportOnline(true);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await seed(vault.db, [{ seq: 2 }]);
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("does not touch the network while the app is offline", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [{ seq: 1 }]);
    reportOnline(false);

    await requestSync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingOperations(vault.db)).toHaveLength(1);
  });
});

describe("backoff", () => {
  it("doubles from a second and stops at a minute", () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 20].map((failures) => backoffDelay(failures, () => 1));
    expect(steps).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
    expect(steps.every((delay) => delay <= BACKOFF_MAX_MS)).toBe(true);
  });

  it("jitters below the step, never above it", () => {
    expect(backoffDelay(1, () => 0)).toBe(BACKOFF_MIN_MS / 2);
    expect(backoffDelay(1, () => 0.5)).toBe(750);
    expect(backoffDelay(1, () => 1)).toBe(BACKOFF_MIN_MS);
  });

  it("comes back on its own after a failure, and waits longer the second time", async () => {
    const vault = await vaultWith();
    const waits: number[] = [];
    let fire: (() => void) | null = null;
    startSyncEngine({
      random: () => 1,
      schedule: (run, delayMs) => {
        waits.push(delayMs);
        fire = run;
        return () => undefined;
      },
    });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));

    await requestSync();
    expect(waits).toEqual([BACKOFF_MIN_MS]);

    (fire as unknown as () => void)();
    await vi.waitFor(() => {
      expect(waits).toEqual([BACKOFF_MIN_MS, 2 * BACKOFF_MIN_MS]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Nothing was reordered and nothing was dropped: the operation is still first in line.
    expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([1]);
  });

  it("waits at least as long as a 429 asked for", async () => {
    const vault = await vaultWith();
    const waits: number[] = [];
    startSyncEngine({
      random: () => 1,
      schedule: (_run, delayMs) => {
        waits.push(delayMs);
        return () => undefined;
      },
    });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          { code: "RATE_LIMITED", message: "slow down" },
          { status: 429, headers: { "retry-after": "30" } },
        ),
      ),
    );

    await requestSync();

    expect(waits).toEqual([30_000]);
  });

  it("stops waiting once the queue goes through", async () => {
    const vault = await vaultWith();
    const cancelled = vi.fn();
    startSyncEngine({ schedule: () => cancelled });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")))
      .mockImplementationOnce(() => Promise.resolve(json(transaction({ id: "t1" }))));

    await requestSync();
    await requestSync();

    expect(cancelled).toHaveBeenCalled();
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("what the engine sends after the queue is folded", () => {
  it("turns ten offline edits into one request guarded by the first updatedAt", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", amount: 1 })));
    reportOnline(false);
    for (let amount = 2; amount <= 11; amount += 1) await updateTransaction("t1", { amount });
    expect(await pendingOperations(vault.db)).toHaveLength(10);

    fetchMock.mockImplementation(() =>
      Promise.resolve(json(transaction({ id: "t1", amount: 11 }))),
    );
    reportOnline(true);
    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ amount: 11 });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("If-Match")).toBe(
      transaction({ id: "t1" }).updatedAt,
    );
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("sends nothing for a movement created and deleted with no network, and keeps no row", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const id = "11111111-1111-7111-8111-111111111111";
    await createTransaction(
      { type: "EXPENSE", amount: 5, date: "2026-09-04T10:00:00.000Z", fromAccountId: "a1" },
      id,
    );
    await deleteTransaction(id);
    reportOnline(true);

    await requestSync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(await vault.db.get("transactions", id)).toBeUndefined();
    expect(outboxStatusStore.getSnapshot().pending).toBe(0);
  });
});

describe("a client id another user already owns (F-21)", () => {
  it("mints a new one, moves the row and everything that named it, and retries once", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 0 });
    await createTransaction(
      {
        type: "EXPENSE",
        amount: 12.5,
        date: "2026-09-04T10:00:00.000Z",
        fromAccountId: created.id,
      },
      "22222222-2222-7222-8222-222222222222",
    );
    reportOnline(true);

    fetchMock.mockImplementation((input, init) => {
      const body = JSON.parse(bodyOf(init)) as { id: string };
      if (!urlOf(input).endsWith("/api/accounts")) return Promise.resolve(json(transaction({})));
      return Promise.resolve(
        body.id === created.id
          ? json({ code: "ID_TAKEN", message: "taken" }, { status: 409 })
          : json(account({ id: body.id, name: "Wallet" }), { status: 201 }),
      );
    });

    await requestSync();

    const minted = JSON.parse(bodyOf(fetchMock.mock.calls[1]?.[1])) as { id: string };
    expect(minted.id).not.toBe(created.id);
    expect(await vault.db.get("accounts", created.id)).toBeUndefined();
    expect(await vault.db.get("accounts", minted.id)).toBeDefined();
    const movement = JSON.parse(bodyOf(fetchMock.mock.calls[2]?.[1])) as {
      fromAccountId: string;
    };
    expect(movement.fromAccountId).toBe(minted.id);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("does not mint a second time: a fresh UUID that collides twice is a bug, not luck", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      {
        seq: 1,
        entity: "account",
        entityId: "a9",
        action: "create",
        payload: { body: { id: "a9" } },
      },
    ]);
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ code: "ID_TAKEN", message: "taken" }, { status: 409 })),
    );

    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [left] = await pendingOperations(vault.db);
    expect(left).toMatchObject({ status: "failed", lastError: "ID_TAKEN", reminted: true });
    expect(left?.entityId).not.toBe("a9");
  });

  it("keeps what the figure moved when the row moves to a new id", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const id = "33333333-3333-7333-8333-333333333333";
    await createTransaction(
      { type: "EXPENSE", amount: 40, date: "2026-09-04T10:00:00.000Z", fromAccountId: "a1" },
      id,
    );
    reportOnline(true);
    let taken = true;
    fetchMock.mockImplementation(() => {
      if (!taken) return Promise.resolve(json(transaction({ id: "server" })));
      taken = false;
      return Promise.resolve(json({ code: "ID_TAKEN", message: "taken" }, { status: 409 }));
    });

    const before = operationPayload((await pendingOperations(vault.db))[0]!).effect;
    await requestSync();

    expect(await vault.db.get("transactions", id)).toBeUndefined();
    expect(before?.after).toMatchObject({ amount: 40 });
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("a batch of rows (F-20)", () => {
  it("queues one operation per row and drains them in a single pass", async () => {
    const vault = await vaultWith();
    for (const id of ["t1", "t2"]) {
      await vault.db.put("transactions", transactionRecord(transaction({ id })));
    }
    reportOnline(false);

    const result = await batchUpdateTransactions({
      items: [
        { id: "t1", categoryId: "c2", pendingDetails: false },
        { id: "t2", categoryId: "c1", pendingDetails: false },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.updated.map((row) => row.id)).toEqual(["t1", "t2"]);
    expect(result.failed).toEqual([]);
    const queued = await pendingOperations(vault.db);
    expect(queued.map((entry) => `${entry.entity}:${entry.action}:${entry.entityId}`)).toEqual([
      "transaction:update:t1",
      "transaction:update:t2",
    ]);

    fetchMock.mockImplementation((input) =>
      Promise.resolve(json(transaction({ id: urlOf(input).endsWith("t1") ? "t1" : "t2" }))),
    );
    reportOnline(true);
    await requestSync();

    expect(calls()).toEqual(["PUT /api/transactions/t1", "PUT /api/transactions/t2"]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("keeps the rows the server refused apart from the rows it took", async () => {
    const vault = await vaultWith();
    for (const id of ["t1", "t2"]) {
      await vault.db.put("transactions", transactionRecord(transaction({ id })));
    }
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith("t2")
          ? json({ code: "CATEGORY_ARCHIVED", message: "archived" }, { status: 409 })
          : json(transaction({ id: "t1" })),
      ),
    );

    const result = await batchUpdateTransactions({
      items: [
        { id: "t1", categoryId: "c2", pendingDetails: false },
        { id: "t2", categoryId: "c9", pendingDetails: false },
      ],
    });

    expect(result.updated.map((row) => row.id)).toEqual(["t1"]);
    expect(result.failed).toMatchObject([{ id: "t2", code: "CATEGORY_ARCHIVED" }]);
    // The refused row goes back to what the mirror held; the row that went through does not.
    expect((await vault.db.get("transactions", "t2"))?.row.categoryId).toBe("c1");
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});
