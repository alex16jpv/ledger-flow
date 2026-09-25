import { openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";
import type { SyncTransaction } from "@/types/api";

import type { VaultHandle } from "../db";
import { refreshOutboxStatus, resetOutboxStatus } from "../outbox/status";
import { setCurrentVault } from "../repository";
import * as read from "../repository/read";
import { transactionRecord } from "../schema";
import { markSuggestionsStale } from "./stale";
import { resetSuggestStore, SUGGEST_BATCH, suggestDescriptions, suggestStore } from "./store";

vi.mock("../repository/read", async (importOriginal) => {
  const original = await importOriginal<typeof read>();
  return { ...original, mirrorReady: vi.fn(original.mirrorReady) };
});

const USER = "u1";
const READY = "2026-09-03T12:00:00.000Z";

async function seed(vault: VaultHandle, rows: SyncTransaction[]): Promise<void> {
  const tx = vault.db.transaction("transactions", "readwrite");
  for (const row of rows) void tx.store.put(transactionRecord(row));
  await tx.done;
}

const stamp = (i: number): string => new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

let vault: VaultHandle;
let unsubscribe: () => void = () => undefined;
let changes = 0;

async function ready(): Promise<void> {
  await vault.db.put("meta", { key: "syncedAt", value: READY });
}

function listen(): void {
  unsubscribe = suggestStore.subscribe(() => {
    changes += 1;
  });
}

async function built() {
  await vi.waitFor(() => {
    expect(suggestStore.getSnapshot()).not.toBeNull();
  });
  return suggestStore.getSnapshot()!;
}

beforeEach(async () => {
  changes = 0;
  resetSuggestStore({ cap: 1_020 });
  vault = await openTestVault(USER);
  setCurrentVault(vault);
});

afterEach(async () => {
  unsubscribe();
  setCurrentVault(null);
  resetOutboxStatus();
  resetSuggestStore();
  await wipeVaults();
});

describe("suggestStore", () => {
  it("builds the index once the mirror can answer, from the live rows of the three types", async () => {
    await seed(vault, [
      transaction({ id: "a", description: "Uber to work" }),
      transaction({ id: "b", description: "Uber gone", deletedAt: "2026-08-02T00:00:00.000Z" }),
      transaction({ id: "c", description: "Uber adjusted", type: "ADJUSTMENT" }),
    ]);
    const looked = vi.mocked(read.mirrorReady);
    looked.mockClear();
    listen();
    await settle();
    expect(suggestStore.getSnapshot()).toBeNull();
    // Not ready is not a reason to ask again: one look at `syncedAt` per trigger, never a loop.
    expect(looked).toHaveBeenCalledTimes(1);
    await ready();
    markSuggestionsStale();
    const index = await built();
    expect(index.rows).toBe(1);
    expect(suggestDescriptions(index, "EXPENSE", "ub").map((s) => s.text)).toEqual([
      "Uber to work",
    ]);
  });

  it("reads newest first in batches and stops at the cap", async () => {
    const rows = Array.from({ length: SUGGEST_BATCH + 50 }, (_, i) =>
      transaction({ id: `r${i}`, description: `Row ${i}.`, date: stamp(i) }),
    );
    await seed(vault, rows);
    await ready();
    listen();
    const index = await built();
    expect(index.rows).toBe(1_020);
    const found = (query: string) => suggestDescriptions(index, "EXPENSE", query).length;
    expect(found(`${SUGGEST_BATCH + 49}.`)).toBe(1);
    expect(found("300.")).toBe(1);
    expect(found("30.")).toBe(1);
    expect(found("29.")).toBe(0);
  });

  it("rebuilds after a stale mark, and a queue change is one", async () => {
    await seed(vault, [transaction({ id: "a", description: "Latte" })]);
    await ready();
    listen();
    const first = await built();
    await seed(vault, [transaction({ id: "b", description: "Lunch" })]);
    markSuggestionsStale();
    await vi.waitFor(() => {
      expect(suggestStore.getSnapshot()).not.toBe(first);
    });
    expect(suggestDescriptions(suggestStore.getSnapshot()!, "EXPENSE", "lu")).toHaveLength(1);

    const second = suggestStore.getSnapshot();
    await seed(vault, [transaction({ id: "c", description: "Lemonade" })]);
    await vault.db.put("outbox", {
      seq: 1,
      opId: "op-c",
      opVersion: 1,
      entity: "transaction",
      entityId: "c",
      action: "create",
      occurredAt: "2026-09-23T10:00:00.000Z",
      payload: {},
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    await refreshOutboxStatus(vault.db);
    await vi.waitFor(() => {
      expect(suggestStore.getSnapshot()).not.toBe(second);
    });
    expect(suggestDescriptions(suggestStore.getSnapshot()!, "EXPENSE", "le")).toHaveLength(1);
  });

  it("a mark during a build is honoured by one more build, not by the one in flight", async () => {
    await seed(
      vault,
      Array.from({ length: SUGGEST_BATCH + 10 }, (_, i) =>
        transaction({ id: `r${i}`, description: `Row ${i}.`, date: stamp(i) }),
      ),
    );
    await ready();
    listen();
    await seed(vault, [transaction({ id: "late", description: "Latecomer", date: stamp(0) })]);
    markSuggestionsStale();
    await vi.waitFor(() => {
      expect(suggestDescriptions(suggestStore.getSnapshot()!, "EXPENSE", "latec")).toHaveLength(1);
    });
    await vi.waitFor(
      () => {
        expect(changes).toBe(2);
      },
      { timeout: 3_000 },
    );
    await settle();
    expect(changes).toBe(2);
  });

  it("answers nothing once the vault is gone, and drops what it held", async () => {
    await seed(vault, [transaction({ id: "a", description: "Latte" })]);
    await ready();
    listen();
    await built();
    const before = changes;
    setCurrentVault(null);
    expect(suggestStore.getSnapshot()).toBeNull();
    expect(changes).toBe(before + 1);
    markSuggestionsStale();
    expect(suggestStore.getSnapshot()).toBeNull();
    expect(changes).toBe(before + 1);
  });
});
