import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";
import type {
  SyncChangesResponse,
  SyncTransaction,
  Transaction,
  TransactionList,
} from "@/types/api";

import { pullChanges } from "../pull";
import { setCurrentVault } from "./read";
import { readTransaction, readTransactions, readTransactionTags } from "./transactions";

const dinner = transaction({
  id: "t6",
  date: "2026-08-06T12:00:00.000Z",
  amount: 19.99,
  categoryId: "c1",
  fromAccountId: "a1",
  tags: ["travel"],
  description: "Dinner",
});
const salary = transaction({
  id: "t5",
  type: "INCOME",
  date: "2026-08-05T12:00:00.000Z",
  amount: 100,
  categoryId: null,
  fromAccountId: null,
  toAccountId: "a2",
});
const coffee = transaction({
  id: "t4",
  date: "2026-08-04T12:00:00.000Z",
  amount: 0.1,
  categoryId: "c2",
  fromAccountId: "a1",
  pendingDetails: true,
  source: "QUICK",
});
const bus = transaction({
  id: "t3",
  date: "2026-08-03T12:00:00.000Z",
  amount: 0.2,
  categoryId: "c2",
  fromAccountId: "a2",
  pendingDetails: true,
  source: "QUICK",
});
const move = transaction({
  id: "t2",
  type: "TRANSFER",
  date: "2026-08-02T12:00:00.000Z",
  amount: 50,
  categoryId: null,
  fromAccountId: "a1",
  toAccountId: "a2",
});
const erased = transaction({
  id: "t1",
  date: "2026-08-01T12:00:00.000Z",
  amount: 2.3,
  tags: ["travel", "work"],
  deletedAt: "2026-08-10T00:00:00.000Z",
});
const ALL = [dinner, salary, coffee, bus, move, erased];

const apiRow = (row: SyncTransaction): Transaction => {
  const copy: Transaction & { deletedAt?: string | null } = { ...row };
  delete copy.deletedAt;
  return copy;
};
const ids = (list: TransactionList) => list.data.map((row) => row.id);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

function feedPage(transactions: SyncTransaction[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: { user: null, accounts: [], categories: [], transactions, budgets: [] },
    pagination: { limit: 500, count: transactions.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

async function mirrorOf(transactions: SyncTransaction[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(transactions)) });
  setCurrentVault(vault);
  reportOnline(false);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

describe("the transaction list through the repository", () => {
  // O-F2b: the page the mirror builds is the page the endpoint answers — order, total, cursor and
  // `hasMore` included — and from here it is the one the screen gets with network too.
  it("asks the server until a pull has drained and pages the mirror from then on", async () => {
    const served: TransactionList = {
      data: [dinner, salary, coffee].map(apiRow),
      pagination: { limit: 3, offset: 0, total: 5, hasMore: true, nextCursor: "t4" },
    };
    fetchMock.mockResolvedValue(json(served));
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    const beforeSnapshot = await readTransactions({ limit: 3 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/transactions?limit=3");

    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(ALL)) });
    fetchMock.mockClear();
    const online = await readTransactions({ limit: 3 });

    reportOnline(false);
    const offline = await readTransactions({ limit: 3 });

    expect(beforeSnapshot).toEqual(served);
    expect(online).toEqual(served);
    expect(offline).toEqual(served);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("orders by date then id descending, breaking ties on the id", async () => {
    const early = transaction({ id: "t7a", date: "2026-08-07T10:00:00.000Z" });
    const late = transaction({ id: "t7b", date: "2026-08-07T10:00:00.000Z" });
    await mirrorOf([early, late, dinner]);

    expect(ids(await readTransactions({ limit: 30 }))).toEqual(["t7b", "t7a", "t6"]);
  });

  // F-15: with nothing to ask of each row the index counts the set and the walk stops at the page,
  // so a page of an infinite scroll stops costing O(n). A filter still has to look at every row.
  it("counts the same filtered set whether or not the walk stops at the page", async () => {
    await mirrorOf(ALL);

    await expect(readTransactions({ limit: 2 })).resolves.toMatchObject({
      pagination: { limit: 2, offset: 0, total: 5, hasMore: true, nextCursor: "t5" },
    });
    await expect(readTransactions({ type: "EXPENSE", limit: 2 })).resolves.toMatchObject({
      pagination: { limit: 2, offset: 0, total: 3, hasMore: true, nextCursor: "t4" },
    });
    // The page is the whole set: `hasMore` has to come out false with the index's count too.
    await expect(readTransactions({ limit: 5 })).resolves.toMatchObject({
      pagination: { limit: 5, offset: 0, total: 5, hasMore: false, nextCursor: null },
    });
  });

  it("keeps the tombstones out of every page and out of the total", async () => {
    await mirrorOf(ALL);

    const list = await readTransactions({ limit: 30 });

    expect(ids(list)).toEqual(["t6", "t5", "t4", "t3", "t2"]);
    expect(list.pagination.total).toBe(5);
  });
});

describe("the local cursor", () => {
  it("carries on from the row the previous page ended with", async () => {
    await mirrorOf(ALL);

    const first = await readTransactions({ limit: 2 });
    expect(first.pagination).toEqual({
      limit: 2,
      offset: 0,
      total: 5,
      hasMore: true,
      nextCursor: "t5",
    });

    const second = await readTransactions({ limit: 2, cursor: first.pagination.nextCursor });
    expect(ids(second)).toEqual(["t4", "t3"]);

    const third = await readTransactions({ limit: 2, cursor: second.pagination.nextCursor });
    expect(ids(third)).toEqual(["t2"]);
    expect(third.pagination.hasMore).toBe(false);
    expect(third.pagination.nextCursor).toBeNull();
  });

  // An offset would have skipped a row here; the keyset holds because it names where it stopped.
  it("survives rows arriving above the page it already served", async () => {
    const vault = await openTestVault("u1");
    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(ALL)) });
    setCurrentVault(vault);
    reportOnline(false);

    const first = await readTransactions({ limit: 2 });
    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(feedPage([transaction({ id: "t9", date: "2026-08-09T12:00:00.000Z" })])),
    });

    const second = await readTransactions({ limit: 2, cursor: first.pagination.nextCursor });
    expect(ids(second)).toEqual(["t4", "t3"]);
    expect(second.pagination.total).toBe(6);
  });

  // The server reads the pivot's date without the deletedAt guard, so a row deleted between two
  // pages still says where the list was; it just never comes back in one.
  it("never hands back a transaction that was deleted, cursor included", async () => {
    const vault = await openTestVault("u1");
    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(ALL)) });
    setCurrentVault(vault);
    reportOnline(false);

    const first = await readTransactions({ limit: 2 });
    await pullChanges(vault, {
      fetchPage: () =>
        Promise.resolve(feedPage([{ ...salary, deletedAt: "2026-08-11T00:00:00.000Z" }])),
    });

    const second = await readTransactions({ limit: 30, cursor: first.pagination.nextCursor });
    expect(ids(second)).toEqual(["t4", "t3", "t2"]);
  });

  it("asks the server when the mirror never saw the cursor row", async () => {
    await mirrorOf(ALL);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransactions({ limit: 2, cursor: "nope" })).rejects.toThrow(
      "Network request failed",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("the screen filters against the mirror", () => {
  beforeEach(async () => {
    await mirrorOf(ALL);
  });

  it("filters by period, closing the window on the left only", async () => {
    const window = { from: "2026-08-03T00:00:00.000Z", to: "2026-08-05T12:00:00.000Z" };

    expect(ids(await readTransactions({ ...window, limit: 30 }))).toEqual(["t4", "t3"]);
  });

  it("filters by type", async () => {
    expect(ids(await readTransactions({ type: "INCOME", limit: 30 }))).toEqual(["t5"]);
    expect(ids(await readTransactions({ type: "TRANSFER", limit: 30 }))).toEqual(["t2"]);
  });

  it("filters by account on both sides of a transfer", async () => {
    expect(ids(await readTransactions({ accountId: "a2", limit: 30 }))).toEqual(["t5", "t3", "t2"]);
  });

  it("filters by category and by having none", async () => {
    expect(ids(await readTransactions({ categoryId: "c2", limit: 30 }))).toEqual(["t4", "t3"]);
    expect(ids(await readTransactions({ uncategorized: "true", limit: 30 }))).toEqual(["t5", "t2"]);
  });

  it("filters by tag, and the deleted row keeps its tag out of the list", async () => {
    expect(ids(await readTransactions({ tag: "travel", limit: 30 }))).toEqual(["t6"]);
    expect(ids(await readTransactions({ tag: "work", limit: 30 }))).toEqual([]);
  });

  it("filters the ones still to review and the quick ones", async () => {
    expect(ids(await readTransactions({ pendingDetails: "true", limit: 30 }))).toEqual([
      "t4",
      "t3",
    ]);
    expect(ids(await readTransactions({ source: "QUICK", limit: 30 }))).toEqual(["t4", "t3"]);
  });

  it("combines them the way the API ands them together", async () => {
    const list = await readTransactions({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
      type: "EXPENSE",
      accountId: "a1",
      categoryId: "c2",
      limit: 30,
    });

    expect(ids(list)).toEqual(["t4"]);
  });

  // A parameter the mirror does not apply would answer a different question than the one asked.
  it("declines a query it does not know how to filter", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransactions({ ids: "t1,t2", limit: 30 })).rejects.toThrow(
      "Network request failed",
    );
  });
});

describe("the pending tray", () => {
  it("counts and sums the ones still to review, in minor units", async () => {
    await mirrorOf(ALL);

    const list = await readTransactions({ pendingDetails: true, limit: 1, includeSummary: true });

    expect(list.pagination.total).toBe(2);
    expect(list.summary).toEqual({ totalAmount: 0.3 });
    expect(ids(list)).toEqual(["t4"]);
  });

  it("leaves the summary out when it was not asked for", async () => {
    await mirrorOf(ALL);

    expect(await readTransactions({ limit: 1 })).not.toHaveProperty("summary");
  });
});

describe("one transaction and the tag list", () => {
  it("reads a transaction from the mirror without its sync-only field", async () => {
    await mirrorOf(ALL);

    await expect(readTransaction("t6")).resolves.toEqual(apiRow(dinner));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Deleted rows are a 404 everywhere but the sync feed, and only the server can answer that.
  it("asks the server for a deleted transaction and for one it never saw", async () => {
    await mirrorOf(ALL);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransaction("t1")).rejects.toThrow("Network request failed");
    await expect(readTransaction("t99")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lists the distinct tags of the live rows, sorted", async () => {
    await mirrorOf([...ALL, transaction({ id: "t8", tags: ["work", "travel"] })]);

    await expect(readTransactionTags()).resolves.toEqual({ data: ["travel", "work"] });
  });
});
