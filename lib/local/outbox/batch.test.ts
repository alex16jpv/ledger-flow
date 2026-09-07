import {
  answerBatch,
  applied,
  blockedBy,
  conflictWith,
  operationsOf,
  rejectedWith,
  SERVER_TIME,
} from "@/lib/testing/sync";
import {
  account,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";

import { setCurrentVault } from "../repository/read";
import {
  accountRecord,
  categoryRecord,
  type OutboxOperation,
  profileRecord,
  transactionRecord,
} from "../schema";
import {
  batchBody,
  chunkBatch,
  SYNC_MAX_OPERATIONS,
  type SyncOperationInput,
  wireOperation,
} from "./batch";
import type { Collapsed } from "./coalesce";
import { requestSync, resetSyncEngine, syncTransport } from "./engine";
import { readNotices } from "./notices";
import { pendingOperations, type VaultDb } from "./queue";
import { refreshOutboxStatus, resetOutboxStatus } from "./status";

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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  resetSyncEngine();
  resetOutboxStatus();
  setCurrentVault(null);
  vi.unstubAllGlobals();
  await wipeVaults();
});

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    seq: 1,
    opId: "00000000-0000-7000-8000-000000000001",
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
  };
}

const entry = (overrides: Partial<OutboxOperation> = {}): Collapsed => ({
  operation: operation(overrides),
  absorbed: [],
});

async function vaultWith(operations: Partial<OutboxOperation>[]) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(cash));
  let seq = 0;
  for (const overrides of operations) {
    seq += 1;
    await vault.db.put("outbox", operation({ seq, opId: uuid(seq), ...overrides }));
  }
  await vault.db.put("meta", { key: "outboxSeq", value: seq });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const queued = async (db: VaultDb) => await pendingOperations(db);

describe("the envelope the batch sends", () => {
  it("carries what the contract asks for, and nothing the server has no field for", () => {
    const body = batchBody([
      entry({
        seq: 4,
        baseUpdatedAt: "2026-08-01T00:00:00.000Z",
        dependsOn: ["a9"],
        payload: {
          body: { amount: 15 },
          query: { reference: "2026-12-15T12:00:00.000Z" },
          // What the row moved is the local projection's bookkeeping: it never travels.
          effect: { before: null, after: null },
        },
      }),
    ]);

    expect(body.operations[0]).toEqual({
      opId: uuid(1),
      seq: 0,
      occurredAt: "2026-09-04T10:00:00.000Z",
      entity: "transaction",
      action: "update",
      id: "t1",
      payload: { body: { amount: 15 }, query: { reference: "2026-12-15T12:00:00.000Z" } },
      baseUpdatedAt: "2026-08-01T00:00:00.000Z",
      dependsOn: ["a9"],
      opVersion: 1,
    });
  });

  it("numbers the operations by their rank, whatever the device's own seq is", () => {
    // A resolution queued ahead of the operation it unblocks holds a fractional seq (F-58), which
    // the server's `z.number().int()` would refuse: the wire carries the order, not the counter.
    const body = batchBody([entry({ seq: 1.5 }), entry({ seq: 2, entityId: "t2" })]);

    expect(body.operations.map((op) => op.seq)).toEqual([0, 1]);
  });

  it("guards only the first operation of each row (D-34)", () => {
    const stamp = "2026-08-01T00:00:00.000Z";
    const body = batchBody([
      entry({ seq: 1, entityId: "t1", baseUpdatedAt: stamp }),
      entry({ seq: 2, entityId: "t1", action: "delete", baseUpdatedAt: stamp }),
      entry({ seq: 3, entityId: "t2", baseUpdatedAt: stamp }),
    ]);

    expect(body.operations.map((op) => op.baseUpdatedAt)).toEqual([stamp, undefined, stamp]);
  });

  it("guards a row once per pass, not once per batch (F-61)", () => {
    const stamp = "2026-08-01T00:00:00.000Z";
    const pass = new Set<string>();

    const first = batchBody([entry({ seq: 1, entityId: "t1", baseUpdatedAt: stamp })], pass);
    const second = batchBody(
      [entry({ seq: 2, entityId: "t1", action: "delete", baseUpdatedAt: stamp })],
      pass,
    );

    expect(first.operations[0]?.baseUpdatedAt).toBe(stamp);
    expect(second.operations[0]?.baseUpdatedAt).toBeUndefined();
  });

  it("cuts the queue at the two hundred the server takes", () => {
    const entries = Array.from({ length: 201 }, (_, index) => entry({ seq: index + 1 }));

    expect(chunkBatch(entries).map((chunk) => chunk.length)).toEqual([SYNC_MAX_OPERATIONS, 1]);
  });

  it("cuts it before the body passes the megabyte", () => {
    const fat = () => entry({ payload: { body: { note: "x".repeat(100_000) } } });
    const entries = Array.from({ length: 12 }, fat);

    const chunks = chunkBatch(entries);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toHaveLength(12);
  });

  it("sends an operation of its own that is bigger than the budget, alone", () => {
    const entries = [
      entry({ payload: { body: { note: "x".repeat(1_000_000) } } }),
      entry({ seq: 2 }),
    ];

    expect(chunkBatch(entries).map((chunk) => chunk.length)).toEqual([1, 1]);
  });

  it("keeps a body the mirror could not describe out of the payload", () => {
    const wire = wireOperation(operation({ payload: { body: "not an object" } }), 0, true);

    expect(wire.payload).toEqual({});
  });
});

describe("how the engine spreads the answers", () => {
  it("takes an operation the registry already had, with no row to show for it", async () => {
    const vault = await vaultWith([{ entityId: "t1" }]);
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", amount: 99 })));
    answerBatch(fetchMock, () => ({ status: "duplicate" }));

    await requestSync();

    expect(await queued(vault.db)).toEqual([]);
    // Nothing came back to replace the projection: the row stays as the mirror had it, and the pull
    // that closes the round is what brings the server's version.
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(99);
  });

  it("repoints the local id when the server merged the category into its own (F-57)", async () => {
    const server = category({ id: "c-server", name: "Comida" });
    const vault = await vaultWith([
      {
        seq: 1,
        entity: "category",
        entityId: "c-mine",
        action: "create",
        payload: { body: { id: "c-mine", name: "comida", type: "EXPENSE" } },
      },
      {
        seq: 2,
        entityId: "t1",
        action: "create",
        dependsOn: ["c-mine"],
        payload: { body: { id: "t1", categoryId: "c-mine", amount: 5 } },
      },
    ]);
    await vault.db.put("categories", categoryRecord(category({ id: "c-mine", name: "comida" })));
    await vault.db.put(
      "transactions",
      transactionRecord({ ...transaction({ id: "t1" }), categoryId: "c-mine" }),
    );
    answerBatch(fetchMock, (op) =>
      op.entity === "category"
        ? { status: "merged", mergedInto: "c-server", result: server }
        : rejectedWith("FUTURE_DATE"),
    );

    await requestSync();

    // The row the device minted is gone, the server's is in its place…
    expect(await vault.db.get("categories", "c-mine")).toBeUndefined();
    expect((await vault.db.get("categories", "c-server"))?.row.name).toBe("Comida");
    // …the rows that named it point at it…
    expect((await vault.db.get("transactions", "t1"))?.row.categoryId).toBe("c-server");
    // …and so does what is still in the queue, or a retry would ask for an id nobody has.
    const [left] = await queued(vault.db);
    expect(left).toMatchObject({ status: "failed", dependsOn: ["c-server"] });
    expect((left?.payload as { body: { categoryId: string } }).body.categoryId).toBe("c-server");
  });

  it("learns the mapping from a resent opId the registry answered as a merge", async () => {
    const vault = await vaultWith([
      {
        entity: "category",
        entityId: "c-mine",
        action: "create",
        payload: { body: { id: "c-mine", name: "comida" } },
      },
    ]);
    await vault.db.put("categories", categoryRecord(category({ id: "c-mine", name: "comida" })));
    answerBatch(fetchMock, () => ({ status: "duplicate", mergedInto: "c-server" }));

    await requestSync();

    expect(await vault.db.get("categories", "c-mine")).toBeUndefined();
    expect(await vault.db.get("categories", "c-server")).toBeDefined();
    expect(await queued(vault.db)).toEqual([]);
  });

  it("keeps the server's row the mirror already had when a merge lands on it (R-4)", async () => {
    const vault = await vaultWith([
      {
        entity: "category",
        entityId: "c-mine",
        action: "create",
        payload: { body: { id: "c-mine", name: "comida", color: "RED" } },
      },
    ]);
    const server = category({ id: "c-server", name: "Comida", color: "BLUE" });
    await vault.db.put("categories", categoryRecord(server, server));
    await vault.db.put(
      "categories",
      categoryRecord(category({ id: "c-mine", name: "comida", color: "RED" })),
    );
    const named = { ...transaction({ id: "t1" }), categoryId: "c-mine" };
    await vault.db.put("transactions", transactionRecord(named, named));
    // A resent opId the registry answered as a merge: no `result` travels back, so nothing but the
    // mirror itself can keep the server's category as the server has it.
    answerBatch(fetchMock, () => ({ status: "duplicate", mergedInto: "c-server" }));

    await requestSync();

    expect(await vault.db.get("categories", "c-mine")).toBeUndefined();
    const kept = await vault.db.get("categories", "c-server");
    // With no queue left on it, D-24 keeps no separate baseline: the row is the server's.
    expect(kept?.row).toMatchObject({ name: "Comida", color: "BLUE" });
    expect(kept?.server).toBeUndefined();
    // The rows that named it move, baseline included (D-24).
    const moved = await vault.db.get("transactions", "t1");
    expect(moved?.row.categoryId).toBe("c-server");
    expect(moved?.server?.categoryId).toBe("c-server");
  });

  it("keeps the warning of a movement the server saved without its category (F-57)", async () => {
    const vault = await vaultWith([{ entityId: "t1", action: "create" }]);
    const saved = { ...transaction({ id: "t1" }), categoryId: null, pendingDetails: true };
    answerBatch(fetchMock, () => ({
      status: "applied",
      warnings: ["CATEGORY_ARCHIVED_DROPPED"],
      result: saved,
    }));

    await requestSync();

    expect(await readNotices(vault.db)).toEqual([
      { code: "CATEGORY_ARCHIVED_DROPPED", id: "t1", at: saved.updatedAt },
    ]);
    expect((await vault.db.get("transactions", "t1"))?.row.pendingDetails).toBe(true);
  });

  it("holds a movement whose account was archived online, with the account it needs (F-58)", async () => {
    const vault = await vaultWith([
      { entityId: "t1", action: "create", payload: { body: { id: "t1", fromAccountId: "a1" } } },
    ]);
    const archived = account({ id: "a1", name: "Cash", archivedAt: "2026-09-05T00:00:00.000Z" });
    answerBatch(fetchMock, () => conflictWith("RESOURCE_ARCHIVED", archived));

    await requestSync();

    const [stuck] = await queued(vault.db);
    expect(stuck).toMatchObject({
      status: "conflict",
      lastError: "RESOURCE_ARCHIVED",
      archivedId: "a1",
    });
    // The account is not this operation's server version, so it is not kept as one; the mirror does
    // learn it is archived, which is what the sheet reads to offer restoring it.
    expect(stuck?.serverRow).toBeUndefined();
    expect((await vault.db.get("accounts", "a1"))?.row.archivedAt).toBe("2026-09-05T00:00:00.000Z");
  });

  it("keeps the row that holds a taken name for the sheet, without making it the baseline", async () => {
    const vault = await vaultWith([
      {
        entity: "account",
        entityId: "a2",
        action: "create",
        payload: { body: { id: "a2", name: "Cash" } },
      },
    ]);
    await vault.db.put("accounts", accountRecord(account({ id: "a2", name: "Cash" })));
    answerBatch(fetchMock, () => conflictWith("DUPLICATE", cash));

    await requestSync();

    const [stuck] = await queued(vault.db);
    expect(stuck).toMatchObject({ status: "conflict", lastError: "DUPLICATE", serverRow: cash });
    // Somebody else's row: it never becomes this row's baseline in the mirror, which keeps the
    // device's own (the row still has a queue, so D-24 puts one aside).
    expect((await vault.db.get("accounts", "a2"))?.server?.id).toBe("a2");
  });

  it("leaves an operation the server never attempted exactly where it was", async () => {
    const vault = await vaultWith([
      { seq: 1, entityId: "t1" },
      { seq: 2, entityId: "t2", dependsOn: ["t1"] },
    ]);
    answerBatch(fetchMock, (op) =>
      op.id === "t1" ? rejectedWith("VALIDATION") : blockedBy(uuid(1)),
    );

    await requestSync();

    const left = await queued(vault.db);
    expect(left.map((item) => [item.seq, item.status, item.attempts])).toEqual([
      [1, "failed", 1],
      [2, "pending", 0],
    ]);
  });

  it("does not take an operation the batch said nothing about for landed", async () => {
    const vault = await vaultWith([{ entityId: "t1" }]);
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ serverTime: SERVER_TIME, results: [] })),
    );

    await requestSync();

    expect(await queued(vault.db)).toMatchObject([{ status: "pending", lastError: "INTERNAL" }]);
  });
});

describe("a queue bigger than one batch", () => {
  const OLD = "2026-08-01T00:00:00.000Z";

  // What each batch carried, so a test can look at the second one on its own.
  const sentBatches = (): SyncOperationInput[][] =>
    fetchMock.mock.calls.map(([, init]) => operationsOf(init));

  it("sends 250 operations in two batches, in seq order and with nothing dropped", async () => {
    const rows = Array.from({ length: 250 }, (_, index) => `t${index + 1}`);
    const vault = await vaultWith(rows.map((entityId) => ({ entityId })));
    for (const id of rows) {
      await vault.db.put("transactions", transactionRecord(transaction({ id })));
    }
    answerBatch(fetchMock, (op) => applied(transaction({ id: op.id })));

    await requestSync();

    const batches = sentBatches();
    expect(batches.map((batch) => batch.length)).toEqual([SYNC_MAX_OPERATIONS, 50]);
    // The wire's `seq` is the rank inside its own batch (D-33); the order is the queue's.
    expect(batches.flat().map((op) => op.id)).toEqual(rows);
    expect(batches[1]?.map((op) => op.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(await queued(vault.db)).toEqual([]);
  });

  it("does not send the second batch's first operation of a row under a stamp the first already replaced (F-61)", async () => {
    // The row is split across the two batches: 200 other rows sit between its two operations, and
    // `update` → `delete` is not a fold, so both travel in the same pass.
    const middle = Array.from({ length: 200 }, (_, index) => ({
      entityId: `t${index + 2}`,
      baseUpdatedAt: OLD,
    }));
    const vault = await vaultWith([
      { entityId: "t1", baseUpdatedAt: OLD },
      ...middle,
      { entityId: "t1", action: "delete", baseUpdatedAt: OLD },
    ]);
    for (const id of ["t1", ...middle.map((row) => row.entityId)]) {
      await vault.db.put("transactions", transactionRecord(transaction({ id })));
    }
    // The replay of a lost response: the registry remembers the opId and answers without a row, so
    // there is no fresh stamp to rebase the operations behind it onto.
    answerBatch(fetchMock, (op) =>
      op.id === "t1" && op.action === "update"
        ? { status: "duplicate" }
        : applied(transaction({ id: op.id })),
    );

    await requestSync();

    const batches = sentBatches();
    expect(batches).toHaveLength(2);
    const guard = batches[1]?.find((op) => op.id === "t1");
    expect(guard?.action).toBe("delete");
    // Guarded, it would earn a `STALE_UPDATE` that means nothing and land in the conflict sheet.
    expect(guard?.baseUpdatedAt).toBeUndefined();
    expect(await queued(vault.db)).toEqual([]);
  });
});

describe("a server with no batch endpoint", () => {
  const missing = (status: number) =>
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith("/api/sync")
          ? json({ error: "NotFound", message: "no" }, { status })
          : json(transaction({ id: "t1" })),
      ),
    );

  it("sends the queue by the ordinary routes after a 404, and stays there for the session", async () => {
    const vault = await vaultWith([{ entityId: "t1" }]);
    missing(404);

    await requestSync();

    expect(calls()).toEqual(["POST /api/sync", "PUT /api/transactions/t1"]);
    expect(syncTransport()).toBe("routes");
    expect(await queued(vault.db)).toEqual([]);

    // The second drain does not ask again: one answer settles it (owner, 2026-09-06).
    await vault.db.put("outbox", operation({ seq: 2, opId: uuid(2) }));
    await refreshOutboxStatus(vault.db);
    await requestSync();

    expect(calls()).toEqual([
      "POST /api/sync",
      "PUT /api/transactions/t1",
      "PUT /api/transactions/t1",
    ]);
  });

  it("does the same with a 501", async () => {
    const vault = await vaultWith([{ entityId: "t1" }]);
    missing(501);

    await requestSync();

    expect(syncTransport()).toBe("routes");
    expect(await queued(vault.db)).toEqual([]);
  });

  it("sends the plan one request at a time when the envelope itself is refused, and keeps the batch", async () => {
    const vault = await vaultWith([{ entityId: "t1" }]);
    // Nothing was applied: a batch this client cannot fix would stall the queue for good, so each
    // operation goes for the verdict of its own route instead.
    missing(400);

    await requestSync();

    expect(calls()).toEqual(["POST /api/sync", "PUT /api/transactions/t1"]);
    expect(syncTransport()).toBe("batch");
    expect(await queued(vault.db)).toEqual([]);
  });

  it("does not send twice what an earlier batch of the same pass already settled", async () => {
    const vault = await vaultWith([
      { seq: 1, entityId: "t1", payload: { body: { note: "x".repeat(500_000) } } },
      { seq: 2, entityId: "t2", payload: { body: { note: "y".repeat(500_000) } } },
    ]);
    let asked = 0;
    fetchMock.mockImplementation((input, init) => {
      if (!urlOf(input).endsWith("/api/sync")) {
        return Promise.resolve(json(transaction({ id: "t2" })));
      }
      asked += 1;
      // The first batch lands; the second comes back refused as an envelope.
      return asked === 1
        ? Promise.resolve(
            json({
              serverTime: SERVER_TIME,
              results: operationsOf(init).map((op) => ({
                opId: op.opId,
                seq: op.seq,
                entity: op.entity,
                id: op.id,
                ...applied(transaction({ id: op.id })),
              })),
            }),
          )
        : Promise.resolve(json({ error: "BadRequest", message: "no" }, { status: 400 }));
    });

    await requestSync();

    expect(calls()).toEqual([
      "POST /api/sync",
      "POST /api/sync",
      // Only the second row: the first one left the queue with the batch that took it.
      "PUT /api/transactions/t2",
    ]);
    expect(await queued(vault.db)).toEqual([]);
  });
});
