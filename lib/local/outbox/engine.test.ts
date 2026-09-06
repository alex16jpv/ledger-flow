import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { setErrorReporter } from "@/lib/observability/reporter";
import { account, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";
import type { Account, SyncBatchInput, SyncOpResult } from "@/types/api";

import { setCurrentVault } from "../repository/read";
import { accountRecord, type OutboxOperation, profileRecord, transactionRecord } from "../schema";
import { archiveAccount, createAccount, restoreAccount, updateAccount } from "./accounts";
import type { SyncOperationInput } from "./batch";
import {
  AUTO_MERGE_ATTEMPTS,
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  backoffDelay,
  isSyncPaused,
  requestSync,
  resetSyncEngine,
  resumeSyncEngine,
  startSyncEngine,
} from "./engine";
import { operationPayload } from "./envelope";
import { projectBalances } from "./projection";
import { pendingOperations, type VaultDb } from "./queue";
import { EMPTY_OUTBOX, outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";
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

const SERVER_TIME = "2026-09-06T10:00:00.000Z";

const opsOf = (init: RequestInit | undefined): SyncOperationInput[] =>
  (JSON.parse(bodyOf(init)) as SyncBatchInput).operations;

// One entry per batch the engine sent, each listing its operations in the order they travelled.
const batches = (): string[][] =>
  fetchMock.mock.calls.map(([, init]) =>
    opsOf(init).map((op) => `${op.entity}:${op.action}:${op.id}`),
  );

const sent = (): string[] => batches().flat();

// The guards the operations travelled with, batch by batch. `undefined` is an unconditional write:
// inside one batch only the first operation of a row carries its `If-Match` (D-34).
const guards = (): (string | undefined)[] =>
  fetchMock.mock.calls.flatMap(([, init]) => opsOf(init).map((op) => op.baseUpdatedAt));

const bodies = (): unknown[] =>
  fetchMock.mock.calls.flatMap(([, init]) => opsOf(init).map((op) => op.payload.body));

// The server's answer to a batch: one result per operation, `applied` unless the test says else.
function answers(reply: (op: SyncOperationInput) => Partial<SyncOpResult> = () => ({})): void {
  fetchMock.mockImplementation((_input, init) =>
    Promise.resolve(
      json({
        serverTime: SERVER_TIME,
        results: opsOf(init).map((op) => ({
          opId: op.opId,
          seq: op.seq,
          entity: op.entity,
          id: op.id,
          status: "applied",
          ...reply(op),
        })),
      }),
    ),
  );
}

const conflictWith = (code: string, current?: unknown): Partial<SyncOpResult> => ({
  status: "conflict",
  code: code as NonNullable<SyncOpResult["code"]>,
  message: "no",
  ...(current === undefined ? {} : { current: current as SyncOpResult["current"] }),
});

const rejectedWith = (code: string): Partial<SyncOpResult> => ({
  status: "rejected",
  code: code as NonNullable<SyncOpResult["code"]>,
  message: "no",
});

const blockedBy = (opId: string): Partial<SyncOpResult> => ({ status: "blocked", blockedBy: opId });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  setErrorReporter(null);
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
      opId: `00000000-0000-7000-8000-00000000000${seq}`,
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
    answers(() => ({ result: account({ id: "a1", name: "Renamed" }) }));
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

  it("sends the whole queue in one request, in seq order", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1" },
      { seq: 2, entityId: "t2" },
      { seq: 3, entityId: "t3" },
    ]);
    answers((op) => ({ result: transaction({ id: op.id }) }));

    await requestSync();

    expect(calls()).toEqual(["POST /api/sync"]);
    expect(sent()).toEqual([
      "transaction:update:t1",
      "transaction:update:t2",
      "transaction:update:t3",
    ]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("brings the whole batch back to the queue when the request never arrived, dropping nothing", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1" },
      { seq: 2, entityId: "t2" },
      { seq: 3, entityId: "t3" },
    ]);
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));

    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const left = await pendingOperations(vault.db);
    expect(left.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    // The request may have landed: every operation in it counts an attempt, which is what stops the
    // fold from crossing it, and none of them is taken for sent.
    expect(left.map((entry) => [entry.status, entry.attempts, entry.lastError])).toEqual([
      ["pending", 1, "NETWORK"],
      ["pending", 1, "NETWORK"],
      ["pending", 1, "NETWORK"],
    ]);
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
    // The batch sends all three: the server is the one that blocks what named the refused row.
    answers((op) =>
      op.entity === "account"
        ? rejectedWith("VALIDATION")
        : op.entity === "transaction"
          ? blockedBy("00000000-0000-7000-8000-000000000001")
          : { result: { id: "c1", name: "Food" } as SyncOpResult["result"] },
    );

    await requestSync();

    expect(sent()).toEqual(["account:create:a9", "transaction:update:t1", "category:update:c1"]);
    const left = await pendingOperations(vault.db);
    expect(left.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(left[0]?.status).toBe("failed");
    // Never attempted, so nothing about it changed but its place in line.
    expect(left[1]).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("takes the amber off the figures the moment the queue is empty", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(
      { type: "EXPENSE", amount: 5, date: "2026-09-04T10:00:00.000Z", fromAccountId: "a1" },
      "11111111-1111-7111-8111-111111111111",
    );
    expect(outboxStatusStore.getSnapshot().projected.balances).toBe(true);

    answers(() => ({ result: transaction({ id: "11111111-1111-7111-8111-111111111111" }) }));
    reportOnline(true);
    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(outboxStatusStore.getSnapshot()).toEqual(EMPTY_OUTBOX);
  });

  it("pulls after a push, and only after one that reached the server", async () => {
    const vault = await vaultWith();
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    await seed(vault.db, [{ seq: 1 }]);
    answers(() => ({ result: transaction({ id: "t1" }) }));

    await requestSync();
    expect(afterRound).toHaveBeenCalledTimes(1);

    await requestSync();
    expect(afterRound).toHaveBeenCalledTimes(1);
  });

  // F-32: the server refusing a write is the server saying it knows something the mirror does not.
  it("pulls after a refusal for good and after a conflict", async () => {
    const vault = await vaultWith();
    const afterRound = vi.fn();
    startSyncEngine({ afterRound });
    await seed(vault.db, [{ seq: 1 }]);
    answers(() => rejectedWith("VALIDATION"));

    await requestSync();
    expect(afterRound).toHaveBeenCalledTimes(1);

    await seed(vault.db, [{ seq: 1, baseUpdatedAt: "2026-09-04T09:00:00.000Z" }]);
    answers(() => conflictWith("STALE_UPDATE", transaction()));

    await requestSync();
    expect(afterRound).toHaveBeenCalledTimes(2);
  });

  it("does not pull when the round only learned that the network is down", async () => {
    const vault = await vaultWith();
    const afterRound = vi.fn();
    startSyncEngine({ afterRound, schedule: () => () => undefined });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ code: "DB_UNAVAILABLE", message: "later" }, { status: 503 })),
    );

    await requestSync();
    expect(afterRound).not.toHaveBeenCalled();
  });

  it("drains when the network comes back and when the window regains focus", async () => {
    const vault = await vaultWith();
    startSyncEngine();
    await seed(vault.db, [{ seq: 1 }]);
    answers(() => ({ result: transaction({ id: "t1" }) }));

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

  it("ends the pass like a cut network when the vault throws mid-drain (F-27)", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [{ seq: 1 }]);
    const waits: number[] = [];
    const reported: unknown[] = [];
    setErrorReporter((error) => {
      reported.push(error);
    });
    startSyncEngine({
      random: () => 1,
      schedule: (_run, delayMs) => {
        waits.push(delayMs);
        return () => undefined;
      },
    });
    answers(() => ({ result: transaction({ id: "t1" }) }));
    // Another tab upgraded the schema, or the browser took the handle away: every read throws now.
    vault.db.close();

    await expect(requestSync()).resolves.toEqual(new Map());

    expect(reported).toHaveLength(1);
    expect(waits).toEqual([BACKOFF_MIN_MS]);
    // Nothing was sent, so nothing was lost: the retry will find the queue as it was.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers the form instead of rejecting a write that is already queued (F-27)", async () => {
    await vaultWith();
    const reported: unknown[] = [];
    setErrorReporter((error) => {
      reported.push(error);
    });
    startSyncEngine({
      schedule: () => () => undefined,
      afterRound: () => {
        throw new Error("the pull blew up");
      },
    });
    answers(() => ({ result: account({ id: "a1", name: "Renamed" }) }));

    await expect(updateAccount("a1", { name: "Renamed" })).resolves.toMatchObject({
      name: "Renamed",
    });
    expect(reported).toHaveLength(1);
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
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")));
    answers(() => ({ result: transaction({ id: "t1" }) }));

    await requestSync();
    await requestSync();

    expect(cancelled).toHaveBeenCalled();
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("a session that died under the queue (F-26)", () => {
  const unauthorized = () =>
    Promise.resolve(json({ code: "UNAUTHORIZED", message: "no" }, { status: 401 }));

  it("stops instead of asking a dead session once a minute", async () => {
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
    fetchMock.mockImplementation(unauthorized);

    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The backoff never starts: there is nothing to come back to until the user signs in.
    expect(waits).toEqual([]);
    expect(isSyncPaused()).toBe(true);
    // The operation is neither sent nor lost (invariant 7).
    expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([1]);
  });

  it("ignores every trigger while it is paused", async () => {
    const vault = await vaultWith();
    startSyncEngine({ schedule: () => () => undefined });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(unauthorized);

    await requestSync();
    await requestSync();
    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends what it held as soon as the session comes back", async () => {
    const vault = await vaultWith();
    startSyncEngine({ schedule: () => () => undefined });
    await seed(vault.db, [{ seq: 1 }]);
    fetchMock.mockImplementation(unauthorized);
    await requestSync();
    expect(isSyncPaused()).toBe(true);

    answers(() => ({ result: transaction({ id: "t1" }) }));
    resumeSyncEngine();

    await vi.waitFor(async () => {
      expect(await pendingOperations(vault.db)).toEqual([]);
    });
    expect(isSyncPaused()).toBe(false);
  });

  it("does not send one user's queue under another user's session", async () => {
    const vault = await vaultWith();
    startSyncEngine({ schedule: () => () => undefined });
    await seed(vault.db, [{ seq: 1 }]);
    answers(() => ({ result: transaction({ id: "t1" }) }));
    // Somebody else signed in on this device while this tab still held the first user's vault.
    // jsdom refuses to set a `__Host-` cookie over http, so the read is stubbed instead.
    const cookie = vi
      .spyOn(document, "cookie", "get")
      .mockReturnValue("__Host-session=someone-else.1000");

    await requestSync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([1]);
    cookie.mockRestore();
  });
});

describe("what the engine sends after the queue is folded", () => {
  it("turns ten offline edits into one request guarded by the first updatedAt", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", amount: 1 })));
    reportOnline(false);
    for (let amount = 2; amount <= 11; amount += 1) await updateTransaction("t1", { amount });
    expect(await pendingOperations(vault.db)).toHaveLength(10);

    answers(() => ({ result: transaction({ id: "t1", amount: 11 }) }));
    reportOnline(true);
    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual(["transaction:update:t1"]);
    expect(bodies()).toEqual([{ amount: 11 }]);
    expect(guards()).toEqual([transaction({ id: "t1" }).updatedAt]);
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

describe("two guarded operations queued on one row (R-2 §A)", () => {
  const T0 = "2026-08-01T10:00:00.000Z";
  const T1 = "2026-09-04T12:00:00.000Z";

  it("sends the second operation of a row unguarded: edit, then delete", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", updatedAt: T0 })));
    reportOnline(false);
    await updateTransaction("t1", { description: "lunch" });
    await deleteTransaction("t1");
    expect((await pendingOperations(vault.db)).map((entry) => entry.baseUpdatedAt)).toEqual([
      T0,
      T0,
    ]);
    answers((op) =>
      op.action === "update"
        ? { result: transaction({ id: "t1", description: "lunch", updatedAt: T1 }) }
        : {},
    );
    reportOnline(true);

    await requestSync();

    // Both travel in one batch, so there is no gap to rebase the second guard in: the stamp the
    // first one earns is the server's own, and it applies them in `seq` order (D-34).
    expect(sent()).toEqual(["transaction:update:t1", "transaction:delete:t1"]);
    expect(guards()).toEqual([T0, undefined]);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("transactions", "t1"))?.row.deletedAt).not.toBeNull();
  });

  it("lets the server block the rest of the row when the guarded one conflicts", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", updatedAt: T0 })));
    reportOnline(false);
    await updateTransaction("t1", { amount: 99 });
    await deleteTransaction("t1");
    reportOnline(true);
    answers((op) =>
      op.action === "update"
        ? conflictWith("STALE_UPDATE", transaction({ id: "t1", amount: 42, updatedAt: T1 }))
        : blockedBy(opsOf(fetchMock.mock.calls[0]?.[1])[0]?.opId ?? ""),
    );

    await requestSync();

    // The unguarded delete was never applied: `POST /sync` blocks by entity id, which is what makes
    // dropping its guard safe (D-30).
    const left = await pendingOperations(vault.db);
    expect(left.map((entry) => [entry.action, entry.status])).toEqual([
      ["update", "conflict"],
      ["delete", "pending"],
    ]);
  });

  it("archive, then restore: the restore carries the stamp the archive answered with", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await archiveAccount("a1");
    await restoreAccount("a1");
    answers((op) => ({
      result:
        op.action === "archive"
          ? account({ id: "a1", archivedAt: T1, updatedAt: T1 })
          : account({ id: "a1", updatedAt: "2026-09-04T12:00:01.000Z" }),
    }));
    reportOnline(true);

    await requestSync();

    expect(sent()).toEqual(["account:archive:a1", "account:restore:a1"]);
    expect(guards()).toEqual(["2026-08-01T00:00:00.000Z", undefined]);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("accounts", "a1"))?.row.archivedAt).toBeNull();
  });

  it("settles an operation the server took without sending a row back", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await archiveAccount("a1");
    await restoreAccount("a1");
    // `applied` with no `result`: what a route that answers a message looks like in a batch.
    answers((op) =>
      op.action === "archive" ? {} : { result: account({ id: "a1", updatedAt: T1 }) },
    );
    reportOnline(true);

    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("accounts", "a1"))?.row.archivedAt).toBeNull();
  });

  it("drops the guard of the second operation of a row whatever stamp it held", async () => {
    const vault = await vaultWith();
    const elsewhere = "2026-09-03T00:00:00.000Z";
    // An edit and a delete do not fold, so both go out; the delete's guard came from a later pull.
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { description: "one" } } },
      { seq: 2, entityId: "t1", action: "delete", baseUpdatedAt: elsewhere },
    ]);
    answers((op) =>
      op.action === "update" ? { result: transaction({ id: "t1", updatedAt: T1 }) } : {},
    );

    await requestSync();

    expect(sent()).toEqual(["transaction:update:t1", "transaction:delete:t1"]);
    expect(guards()).toEqual([T0, undefined]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("guards an operation queued behind an unsent create with the stamp the create earned", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    // A create and an archive do not fold; neither carries a guard the server ever printed.
    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 0 });
    await archiveAccount(created.id);
    expect((await pendingOperations(vault.db)).map((entry) => entry.baseUpdatedAt)).toEqual([
      undefined,
      undefined,
    ]);
    answers((op) =>
      op.action === "create"
        ? { result: account({ id: created.id, name: "Wallet", updatedAt: T1 }) }
        : {},
    );
    reportOnline(true);

    await requestSync();

    expect(sent()).toEqual([`account:create:${created.id}`, `account:archive:${created.id}`]);
    expect(guards()).toEqual([undefined, undefined]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("an operation that sits ahead of the create it names (R-2 §B)", () => {
  it("waits for the create, and goes out in the next look", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1", dependsOn: ["a9"], payload: { body: { fromAccountId: "a9" } } },
      {
        seq: 2,
        entity: "account",
        entityId: "a9",
        action: "create",
        payload: { body: { id: "a9" } },
      },
    ]);
    answers((op) => ({
      result: op.entity === "account" ? account({ id: "a9" }) : transaction({ id: "t1" }),
    }));

    await requestSync();

    // The movement is held out of the first batch — nothing may go ahead of the create it names —
    // and leaves in the next one.
    expect(batches()).toEqual([["account:create:a9"], ["transaction:update:t1"]]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("a refused fold that cannot be undone whole (R-2 §C)", () => {
  it("keeps the whole run as failed instead of undoing only the half it still can", async () => {
    const vault = await vaultWith();
    // As a reload leaves it: the first edit projected in the mirror, its operation queued, no undo.
    await vault.db.put("accounts", accountRecord(account({ id: "a1", name: "First" })));
    await seed(vault.db, [
      {
        seq: 1,
        entity: "account",
        entityId: "a1",
        action: "update",
        baseUpdatedAt: "2026-08-01T00:00:00.000Z",
        payload: { body: { name: "First" } },
      },
    ]);
    reportOnline(false);
    await updateAccount("a1", { name: "Second" });
    answers(() => rejectedWith("VALIDATION"));
    reportOnline(true);

    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await pendingOperations(vault.db)).map((entry) => [entry.seq, entry.status])).toEqual([
      [1, "failed"],
      [2, "pending"],
    ]);
    expect((await vault.db.get("accounts", "a1"))?.row.name).toBe("Second");
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

    answers((op) => {
      if (op.entity !== "account") {
        return op.dependsOn.includes(created.id)
          ? blockedBy(opsOf(fetchMock.mock.calls[0]?.[1])[0]?.opId ?? "")
          : { result: transaction({}) };
      }
      return op.id === created.id
        ? conflictWith("ID_TAKEN")
        : { result: account({ id: op.id, name: "Wallet" }) };
    });

    await requestSync();

    const second = opsOf(fetchMock.mock.calls[1]?.[1]);
    const minted = second[0]?.id ?? "";
    expect(minted).not.toBe(created.id);
    expect(await vault.db.get("accounts", created.id)).toBeUndefined();
    expect(await vault.db.get("accounts", minted)).toBeDefined();
    expect(second[1]?.payload.body).toMatchObject({ fromAccountId: minted });
    expect(second[1]?.dependsOn).toEqual([minted]);
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
    answers(() => conflictWith("ID_TAKEN"));

    await requestSync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [left] = await pendingOperations(vault.db);
    // A second collision is the batch's own `conflict`, and it waits for the user in the tray.
    expect(left).toMatchObject({ status: "conflict", lastError: "ID_TAKEN", reminted: true });
    expect(left?.entityId).not.toBe("a9");
  });

  it("moves the effects of the movements queued against a re-minted account (R-2 §D1)", async () => {
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
      "44444444-4444-7444-8444-444444444444",
    );
    reportOnline(true);
    let asked = 0;
    fetchMock.mockImplementation((_input, init) => {
      asked += 1;
      if (asked > 1) return Promise.reject(new TypeError("Failed to fetch"));
      const operations = opsOf(init);
      return Promise.resolve(
        json({
          serverTime: SERVER_TIME,
          results: operations.map((op) => ({
            opId: op.opId,
            seq: op.seq,
            entity: op.entity,
            id: op.id,
            ...(op.entity === "account"
              ? conflictWith("ID_TAKEN")
              : blockedBy(operations[0]?.opId ?? "")),
          })),
        }),
      );
    });

    await requestSync();

    const [accountOp, movementOp] = await pendingOperations(vault.db);
    const minted = accountOp?.entityId ?? "";
    expect(minted).not.toBe(created.id);
    expect(operationPayload(movementOp!).effect?.after).toMatchObject({ fromAccountId: minted });
    expect(projectBalances([{ id: minted, balance: 0 }], [movementOp!])).toEqual([
      { accountId: minted, balance: -12.5 },
    ]);
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
    answers((op) => {
      if (!taken) return { result: transaction({ id: op.id }) };
      taken = false;
      return conflictWith("ID_TAKEN");
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

    answers((op) => ({ result: transaction({ id: op.id }) }));
    reportOnline(true);
    await requestSync();

    expect(batches()).toEqual([["transaction:update:t1", "transaction:update:t2"]]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("keeps the rows the server refused apart from the rows it took", async () => {
    const vault = await vaultWith();
    for (const id of ["t1", "t2"]) {
      await vault.db.put("transactions", transactionRecord(transaction({ id })));
    }
    answers((op) =>
      op.id === "t2" ? rejectedWith("CATEGORY_ARCHIVED") : { result: transaction({ id: "t1" }) },
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

describe("what a 409 STALE_UPDATE does (O-F5a)", () => {
  const T0 = "2026-08-01T10:00:00.000Z";
  const T1 = "2026-09-04T12:00:00.000Z";

  const stale = (current: unknown) => conflictWith("STALE_UPDATE", current);

  it("merges a text-only edit over the stamp the server answered with, without asking", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { description: "lunch" } } },
    ]);
    let answered = 0;
    answers(() => {
      answered += 1;
      return answered === 1
        ? stale(transaction({ id: "t1", description: "elsewhere", updatedAt: T1 }))
        : { result: transaction({ id: "t1", description: "lunch", updatedAt: T1 }) };
    });

    await requestSync();

    expect(guards()).toEqual([T0, T1]);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(outboxStatusStore.getSnapshot().attention).toBe(0);
  });

  it("asks about money, and keeps the server's row for the sheet", async () => {
    const vault = await vaultWith();
    const server = transaction({ id: "t1", amount: 42, updatedAt: T1 });
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { amount: 15 } } },
    ]);
    answers(() => stale(server));

    await requestSync();

    expect(sent()).toEqual(["transaction:update:t1"]);
    const [queued] = await pendingOperations(vault.db);
    expect(queued).toMatchObject({ status: "conflict", serverRow: server });
    expect(outboxStatusStore.getSnapshot().attention).toBe(1);
  });

  it("does not retry a text edit against a stamp that did not move", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { note: "later" } } },
    ]);
    answers(() => stale(transaction({ id: "t1", updatedAt: T0 })));

    await requestSync();

    expect(sent()).toEqual(["transaction:update:t1"]);
    expect((await pendingOperations(vault.db)).map((entry) => entry.status)).toEqual(["conflict"]);
  });

  it("stops merging by itself and asks when the row will not stop moving", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { description: "mine" } } },
    ]);
    let answered = 0;
    answers(() => {
      answered += 1;
      return stale(transaction({ id: "t1", updatedAt: `2026-09-04T12:0${answered}:00.000Z` }));
    });

    await requestSync();

    expect(answered).toBe(AUTO_MERGE_ATTEMPTS + 1);
    const [queued] = await pendingOperations(vault.db);
    expect(queued).toMatchObject({ status: "conflict", attempts: AUTO_MERGE_ATTEMPTS + 1 });
  });

  it("still holds only what named the row it could not write", async () => {
    const vault = await vaultWith();
    await seed(vault.db, [
      { seq: 1, entityId: "t1", baseUpdatedAt: T0, payload: { body: { amount: 15 } } },
      { seq: 2, entityId: "t2", baseUpdatedAt: T0, payload: { body: { amount: 30 } } },
    ]);
    answers((op) =>
      op.id === "t1"
        ? stale(transaction({ id: "t1", updatedAt: T1 }))
        : { result: transaction({ id: "t2", updatedAt: T1 }) },
    );

    await requestSync();

    expect(sent()).toEqual(["transaction:update:t1", "transaction:update:t2"]);
    expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([1]);
  });
});
