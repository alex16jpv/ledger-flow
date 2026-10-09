import { transaction, wipeVaults } from "@/lib/testing/vault";
import type { SyncBatchInput, SyncBatchResponse } from "@/types/api";

import type { VaultHandle } from "../db";
import type { OutboxOperation } from "../schema";
import type { SyncOperationInput } from "./batch";
import type * as Engine from "./engine";
import type * as Status from "./status";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

const opsOf = (init: RequestInit | undefined): SyncOperationInput[] =>
  (JSON.parse(typeof init?.body === "string" ? init.body : "{}") as SyncBatchInput).operations;

const batches = (): unknown[][] =>
  fetchMock.mock.calls.map(([, init]) => opsOf(init).map((op) => op.payload.body));

const actions = (): string[][] =>
  fetchMock.mock.calls.map(([, init]) => opsOf(init).map((op) => `${op.entity}:${op.action}`));

// The rows the server holds, so a test can tell whether a deleted movement came back.
const onServer = new Set<string>();

const reply = (init: RequestInit | undefined): Response =>
  json({
    serverTime: "2026-10-08T10:00:00.000Z",
    results: opsOf(init).map((op) => {
      if (op.action === "delete") onServer.delete(op.id);
      else onServer.add(op.id);
      return {
        opId: op.opId,
        seq: op.seq,
        entity: op.entity,
        id: op.id,
        status: "applied",
        ...(op.action === "delete" ? {} : { result: transaction({ id: op.id }) }),
      };
    }),
  } satisfies SyncBatchResponse);

// A Web Lock per name, granted in request order, honouring `signal` while it waits.
function installLocks(): { holdUntil: (name: string) => () => void } {
  const tails = new Map<string, Promise<unknown>>();
  const request = (
    name: string,
    optionsOrRun: LockOptions | (() => Promise<unknown>),
    maybeRun?: () => Promise<unknown>,
  ): Promise<unknown> => {
    const run = typeof optionsOrRun === "function" ? optionsOrRun : maybeRun;
    const signal = typeof optionsOrRun === "function" ? undefined : optionsOrRun.signal;
    if (!run) throw new TypeError("no callback");
    const previous = tails.get(name) ?? Promise.resolve();
    const granted = new Promise<void>((resolve, reject) => {
      signal?.addEventListener("abort", () => {
        reject(signal.reason as Error);
      });
      void previous.then(() => {
        resolve();
      });
    });
    const held = granted.then(run);
    // A request that gave up never held the lock, so whoever held it still does.
    tails.set(
      name,
      granted.then(
        () => held.catch(() => undefined),
        () => previous,
      ),
    );
    return held;
  };
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  return {
    holdUntil: (name) => {
      let release: () => void = () => undefined;
      tails.set(
        name,
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      return () => {
        release();
      };
    },
  };
}

interface Tab {
  engine: typeof Engine;
  status: typeof Status;
  vault: VaultHandle;
}

const tabs: Tab[] = [];

// Each tab is its own copy of every module, with its own connection to the one IndexedDB.
async function openTab(): Promise<Tab> {
  vi.resetModules();
  const engine = await import("./engine");
  const status = await import("./status");
  const { openVault } = await import("../db");
  const { setCurrentVault } = await import("../repository/read");
  const vault = await openVault("u1");
  setCurrentVault(vault);
  const tab = { engine, status, vault };
  tabs.push(tab);
  return tab;
}

const operation = (
  seq: number,
  body: Record<string, unknown>,
  action = "update",
): OutboxOperation => ({
  seq,
  opId: `00000000-0000-7000-8000-00000000000${seq}`,
  opVersion: 1,
  entity: "transaction",
  entityId: "t1",
  action,
  occurredAt: "2026-10-08T09:00:00.000Z",
  payload: action === "delete" ? {} : { body },
  dependsOn: [],
  status: "pending",
  attempts: 0,
  lastError: null,
});

async function queue(vault: VaultHandle, entry: OutboxOperation): Promise<void> {
  await vault.db.put("outbox", entry);
  await vault.db.put("meta", { key: "outboxSeq", value: entry.seq });
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

let answerFirst: () => void = () => undefined;

// The first batch waits for the test to answer it; every later one is answered at once.
function holdFirstBatch(): void {
  fetchMock.mockImplementationOnce(
    (_input, init) =>
      new Promise((resolve) => {
        answerFirst = () => {
          resolve(reply(init));
        };
      }),
  );
  fetchMock.mockImplementation((_input, init) => Promise.resolve(reply(init)));
}

interface Timer {
  run: () => void;
  delayMs: number;
}

// Every timer the engine sets, run only when the test says so.
function manualTimers(tab: Tab): Timer[] {
  const timers: Timer[] = [];
  tab.engine.startSyncEngine({
    schedule: (run, delayMs) => {
      timers.push({ run, delayMs });
      return () => undefined;
    },
  });
  return timers;
}

beforeEach(() => {
  onServer.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  answerFirst();
  for (const tab of tabs.splice(0)) {
    await tab.engine.resetSyncEngine();
    tab.vault.close();
  }
  Reflect.deleteProperty(navigator, "locks");
  vi.unstubAllGlobals();
  await wipeVaults();
});

describe("two tabs draining one queue (T-165)", () => {
  it("sends from one tab at a time: an edit queued while another tab sends goes after it, once", async () => {
    installLocks();
    const a = await openTab();
    const b = await openTab();
    await queue(a.vault, operation(1, { note: "first" }));
    holdFirstBatch();

    const drainA = a.engine.requestSync();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await queue(b.vault, operation(2, { amount: 500 }));
    const drainB = b.engine.requestSync();
    await settled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    answerFirst();
    await Promise.all([drainA, drainB]);

    expect(batches()).toEqual([[{ note: "first" }], [{ amount: 500 }]]);
    expect(await a.vault.db.getAll("outbox")).toEqual([]);
  });

  it("does not let a delete queued in one tab overtake the create another tab is sending", async () => {
    installLocks();
    const a = await openTab();
    const b = await openTab();
    await queue(a.vault, operation(1, { id: "t1", amount: 500 }, "create"));
    holdFirstBatch();

    const drainA = a.engine.requestSync();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await queue(b.vault, operation(2, {}, "delete"));
    const drainB = b.engine.requestSync();
    await settled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    answerFirst();
    await Promise.all([drainA, drainB]);

    expect(actions()).toEqual([["transaction:create"], ["transaction:delete"]]);
    expect(onServer.has("t1")).toBe(false);
    expect(await a.vault.db.getAll("outbox")).toEqual([]);
  });

  it("tells the other tabs the queue changed, so their pending count and screens follow", async () => {
    installLocks();
    const a = await openTab();
    const b = await openTab();
    const othersChanged = vi.fn();
    b.engine.startSyncEngine({ schedule: () => () => undefined, othersChanged });
    await queue(a.vault, operation(1, { note: "first" }));
    await a.status.refreshOutboxStatus(a.vault.db);
    await vi.waitFor(() => {
      expect(b.status.outboxStatusStore.getSnapshot().pending).toBe(1);
    });
    fetchMock.mockImplementation((_input, init) => Promise.resolve(reply(init)));

    await a.engine.requestSync();

    await vi.waitFor(() => {
      expect(b.status.outboxStatusStore.getSnapshot().pending).toBe(0);
    });
    expect(othersChanged).toHaveBeenCalledTimes(2);
  });

  it("gives up waiting for a tab that never lets go, keeps the queue, and drains it on the retry", async () => {
    const release = installLocks().holdUntil("lf-outbox-u1");
    const b = await openTab();
    const timers = manualTimers(b);
    await queue(b.vault, operation(1, { note: "first" }));

    const drain = b.engine.requestSync();
    await vi.waitFor(() => {
      expect(timers.map((timer) => timer.delayMs)).toContain(b.engine.OUTBOX_LOCK_WAIT_MS);
    });
    timers.find((timer) => timer.delayMs === b.engine.OUTBOX_LOCK_WAIT_MS)?.run();

    expect(await drain).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await b.vault.db.getAll("outbox")).map((entry) => entry.status)).toEqual(["pending"]);
    const retry = timers.at(-1);
    expect(retry?.delayMs).toBeLessThanOrEqual(b.engine.BACKOFF_MIN_MS);

    release();
    fetchMock.mockImplementation((_input, init) => Promise.resolve(reply(init)));
    retry?.run();

    await vi.waitFor(async () => {
      expect(await b.vault.db.getAll("outbox")).toEqual([]);
    });
    expect(batches()).toEqual([[{ note: "first" }]]);
  });

  it("stops waiting for the queue when the engine stops, and schedules nothing", async () => {
    installLocks().holdUntil("lf-outbox-u1");
    const b = await openTab();
    const timers = manualTimers(b);
    await queue(b.vault, operation(1, { note: "first" }));

    const drain = b.engine.requestSync();
    await vi.waitFor(() => {
      expect(timers).toHaveLength(1);
    });
    await b.engine.resetSyncEngine();

    expect(await drain).toEqual(new Map());
    expect(timers).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
