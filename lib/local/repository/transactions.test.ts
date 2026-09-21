import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  changes as feedChanges,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
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

function feedPage(
  transactions: SyncTransaction[],
  timezone = "America/Bogota",
): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    // Without the profile's zone the mirror declines a filtered read instead of cutting days.
    changes: feedChanges({ user: profile({ id: "u1", timezone }), transactions }),
    pagination: { limit: 500, count: transactions.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

async function mirrorOf(transactions: SyncTransaction[], timezone?: string): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, {
    fetchPage: () => Promise.resolve(feedPage(transactions, timezone)),
  });
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
  // O-F2b: order, total, cursor and `hasMore` included, with network too once a pull drained.
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

  it("orders by amount when asked, with the tie following the direction", async () => {
    const cheap = transaction({ id: "t8a", amount: 12000, date: "2026-08-05T10:00:00.000Z" });
    const same = transaction({ id: "t8b", amount: 12000, date: "2026-08-28T10:00:00.000Z" });
    const big = transaction({ id: "t8c", amount: 90000, date: "2026-08-02T10:00:00.000Z" });
    await mirrorOf([cheap, same, big]);

    expect(ids(await readTransactions({ sort: "amount", order: "desc", limit: 30 }))).toEqual([
      "t8c",
      "t8b",
      "t8a",
    ]);
    expect(ids(await readTransactions({ sort: "amount", order: "asc", limit: 30 }))).toEqual([
      "t8a",
      "t8b",
      "t8c",
    ]);
  });

  it("pages an amount-sorted list from a cursor the filter itself left out", async () => {
    const one = transaction({ id: "x1", amount: 10, categoryId: "c1" });
    const two = transaction({ id: "x2", amount: 20, categoryId: "c2" });
    const three = transaction({ id: "x3", amount: 30, categoryId: "c1" });
    await mirrorOf([one, two, three]);

    const first = await readTransactions({ sort: "amount", order: "desc", limit: 1 });
    expect(ids(first)).toEqual(["x3"]);
    expect(first.pagination).toMatchObject({ total: 3, hasMore: true, nextCursor: "x3" });

    // The pivot is x2, which the category filter drops: the server still places it, and so must this.
    expect(
      ids(
        await readTransactions({
          sort: "amount",
          order: "desc",
          categoryIds: "c1",
          cursor: "x2",
          limit: 30,
        }),
      ),
    ).toEqual(["x1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sums the whole ordered set, not the page it hands back", async () => {
    await mirrorOf([transaction({ id: "x1", amount: 10 }), transaction({ id: "x2", amount: 20 })]);

    await expect(
      readTransactions({ sort: "amount", order: "asc", includeSummary: true, limit: 1 }),
    ).resolves.toMatchObject({
      pagination: { total: 2, hasMore: true, nextCursor: "x1" },
      summary: { totalAmount: 30 },
    });
  });

  it("refuses the pairs the server refuses instead of deciding which one wins", async () => {
    await mirrorOf(ALL);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({ data: [], pagination: { limit: 30, offset: 0, total: 0, hasMore: false } }),
      ),
    );

    await readTransactions({ uncategorized: true, categoryIds: "c1", limit: 30 });
    await readTransactions({ categoryId: "c1", categoryIds: "c2", limit: 30 });
    await readTransactions({ categoryIds: ",", limit: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // The page being full is not the same as there being another row, and the server answers the second.
  it("says there is no more when the last page is exactly full", async () => {
    const rows = [1, 2, 3, 4].map((n) =>
      transaction({
        id: `y${String(n)}`,
        amount: n * 10,
        date: `2026-08-0${String(n)}T10:00:00.000Z`,
      }),
    );
    await mirrorOf(rows);

    await expect(readTransactions({ cursor: "y4", limit: 3 })).resolves.toMatchObject({
      pagination: { total: 4, hasMore: false, nextCursor: null },
    });
    await expect(
      readTransactions({ sort: "amount", order: "desc", cursor: "y4", limit: 3 }),
    ).resolves.toMatchObject({ pagination: { total: 4, hasMore: false, nextCursor: null } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not hand the pivot row back on the page that follows it", async () => {
    await mirrorOf([
      transaction({ id: "z1", amount: 10 }),
      transaction({ id: "z2", amount: 20 }),
      transaction({ id: "z3", amount: 30 }),
    ]);

    const first = await readTransactions({ sort: "amount", order: "asc", limit: 2 });
    expect(ids(first)).toEqual(["z1", "z2"]);
    expect(
      ids(await readTransactions({ sort: "amount", order: "asc", cursor: "z2", limit: 2 })),
    ).toEqual(["z3"]);
  });

  it("asks the server for a pivot the mirror never saw, ordered or not", async () => {
    await mirrorOf(ALL);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({ data: [], pagination: { limit: 30, offset: 0, total: 0, hasMore: false } }),
      ),
    );

    await readTransactions({ sort: "amount", cursor: "nothing-here", limit: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Every one of these the server answers with a 400, so answering here would be another question.
  it.each([
    ["an order it does not have", { order: "sideways" }],
    ["a type it does not have", { type: "NONSENSE" }],
    ["a source it does not have", { source: "BOGUS" }],
    ["a flag that is not a boolean", { pendingDetails: "maybe" }],
    ["an uncategorized that is not a boolean", { uncategorized: "maybe" }],
    ["a limit of none", { limit: 0 }],
    ["a limit that is not a number", { limit: "abc" }],
    ["a limit past the maximum", { limit: 1000 }],
    ["a bound with no offset", { from: "2026-08-01" }],
  ])("declines %s instead of answering without it", async (_name, extra) => {
    await mirrorOf(ALL);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({ data: [], pagination: { limit: 30, offset: 0, total: 0, hasMore: false } }),
      ),
    );

    await readTransactions({ ...(extra as Record<string, string | number>) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks the server for an order it cannot serve, instead of serving another one", async () => {
    await mirrorOf(ALL);
    fetchMock.mockResolvedValue(
      json({ data: [], pagination: { limit: 30, offset: 0, total: 0, hasMore: false } }),
    );

    await readTransactions({ sort: "description", limit: 30 });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("sort=description");
  });

  it("keeps only the categories a list names", async () => {
    await mirrorOf(ALL);

    const page = await readTransactions({ categoryIds: "c1", limit: 30 });
    expect(page.data.every((row) => row.categoryId === "c1")).toBe(true);
    expect(page.data.length).toBeGreaterThan(0);
  });

  // F-15: with nothing to ask of each row the index counts the set and the walk stops at the page.
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

  // The server reads the pivot's date without the deletedAt guard, so a tombstone still anchors.
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
    // Local midnight in Bogota, which is the bound every screen sends.
    const window = { from: "2026-08-03T05:00:00.000Z", to: "2026-08-05T05:00:00.000Z" };

    expect(ids(await readTransactions({ ...window, limit: 30 }))).toEqual(["t4", "t3"]);
  });

  it("keeps a row in the month its day was frozen in, after the account moves zone (T-14)", async () => {
    // 11pm on Aug 31 in Bogota: the instant belongs to September, the accounting day to August.
    const lateNight = transaction({ id: "t9", date: "2026-09-01T04:00:00.000Z" });
    expect(lateNight.dayKey).toBe("2026-08-31");
    // The account has since moved to Madrid, so the window is cut there: [Aug 1, Sep 1) local.
    await mirrorOf([...ALL, lateNight], "Europe/Madrid");

    const august = { from: "2026-07-31T22:00:00.000Z", to: "2026-08-31T22:00:00.000Z" };
    expect(ids(await readTransactions({ ...august, limit: 30 }))).toContain("t9");
  });

  it("widens a window that does not start at local midnight to whole days", async () => {
    // Midday bounds: the API answers the days they fall on, so both ends come in whole.
    const window = { from: "2026-08-03T18:00:00.000Z", to: "2026-08-04T18:00:00.000Z" };

    expect(ids(await readTransactions({ ...window, limit: 30 }))).toEqual(["t4", "t3"]);
  });

  it("takes a bound written with an offset instead of dropping rows of its own day (F-17)", async () => {
    // Midnight in a −05:00 zone is 05:00 UTC but sorts at T00, below every row of its own day.
    const early = transaction({ id: "t5a", date: "2026-08-05T02:00:00.000Z" });
    await mirrorOf([...ALL, early]);

    expect(ids(await readTransactions({ to: "2026-08-05T00:00:00-05:00", limit: 30 }))).toEqual([
      "t5a",
      "t4",
      "t3",
      "t2",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves a bound that is not a date to the server, which answers it with a 400", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransactions({ from: "last tuesday", limit: 30 })).rejects.toThrow(
      "Network request failed",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
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

  // F-46: a deleted row is a 404 everywhere but the sync feed, and the tombstone says so.
  it("answers 404 for a deleted transaction from its own tombstone, without a request", async () => {
    await mirrorOf(ALL);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransaction("t1")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "NOT_FOUND",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still asks the server for a transaction it never saw", async () => {
    await mirrorOf(ALL);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readTransaction("t99")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists the distinct tags of the live rows, sorted", async () => {
    await mirrorOf([...ALL, transaction({ id: "t8", tags: ["work", "travel"] })]);

    await expect(readTransactionTags()).resolves.toEqual({ data: ["travel", "work"] });
  });
});
