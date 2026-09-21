import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  category,
  changes as feedChanges,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SyncChangesResponse, SyncTransaction, User } from "@/types/api";

import { pullChanges } from "../pull";
import { setCurrentVault } from "./read";
import { readSpending } from "./stats";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

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

async function mirrorOf(transactions: SyncTransaction[], user: User | null = profile()) {
  const vault = await openTestVault("u1");
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve<SyncChangesResponse>({
        serverTime: "2026-09-03T12:00:00.000Z",
        changes: feedChanges({
          user,
          categories: [category({ id: "c1" }), category({ id: "c2" })],
          transactions,
        }),
        pagination: {
          limit: 500,
          count: transactions.length,
          hasMore: false,
          nextCursor: "v1|done|",
        },
      }),
  });
  setCurrentVault(vault);
}

// America/Bogota, so a local day runs from 05:00Z to 05:00Z the next day.
const AUGUST = { from: "2026-08-01T05:00:00.000Z", to: "2026-09-01T05:00:00.000Z" };
const MID_AUGUST = { date: "2026-08-10T15:00:00.000Z" };

describe("spending through the repository", () => {
  // O-F2b: the URL still has to be right — it is what a mirror with no zone falls back to.
  it("derives with a mirror to read, and keeps the query it falls back with", async () => {
    fetchMock.mockResolvedValue(json({ groupBy: "day", buckets: [], total: 0 }));
    await mirrorOf([], null);

    await readSpending({ groupBy: "day", type: "EXPENSE", ...AUGUST });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/stats/spending?groupBy=day&type=EXPENSE&from=2026-08-01T05%3A00%3A00.000Z&to=2026-09-01T05%3A00%3A00.000Z",
    );

    setCurrentVault(null);
    await mirrorOf([]);
    fetchMock.mockClear();

    await expect(readSpending({ groupBy: "day", type: "EXPENSE", ...AUGUST })).resolves.toEqual({
      groupBy: "day",
      splitBy: null,
      buckets: [],
      total: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("buckets by the user's local day, not by the UTC one", async () => {
    await mirrorOf([
      // 23:30 on the 20th in Bogota is already the 21st in UTC.
      transaction({ id: "t1", amount: 10, date: "2026-08-21T04:30:00.000Z" }),
      transaction({ id: "t2", amount: 5, date: "2026-08-21T15:00:00.000Z" }),
    ]);
    reportOnline(false);

    await expect(readSpending({ groupBy: "day", type: "EXPENSE", ...AUGUST })).resolves.toEqual({
      groupBy: "day",
      splitBy: null,
      total: 15,
      buckets: [
        { key: "2026-08-20", total: 10, count: 1, avg: 10 },
        { key: "2026-08-21", total: 5, count: 1, avg: 5 },
      ],
    });
  });

  // The controller stamps these on an absent parameter, so the mirror has to stamp them too.
  it("defaults to category buckets of EXPENSE when neither is asked for", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, date: "2026-08-10T15:00:00.000Z" }),
      transaction({ id: "t2", type: "INCOME", amount: 900, date: "2026-08-10T15:00:00.000Z" }),
    ]);
    reportOnline(false);

    await expect(readSpending({})).resolves.toEqual({
      groupBy: "category",
      splitBy: null,
      total: 10,
      buckets: [{ key: "c1", total: 10, count: 1, avg: 10 }],
    });
  });

  // T-28: it used to read four parameters and ignore the rest, so a filter it never applied read whole.
  it("declines a parameter it does not know instead of answering without it", async () => {
    fetchMock.mockResolvedValue(
      json({ groupBy: "category", splitBy: null, buckets: [], total: 0 }),
    );
    await mirrorOf([transaction({ id: "t1", amount: 10, ...MID_AUGUST })]);

    await expect(readSpending({ ...AUGUST, accountId: "a1" })).resolves.toEqual({
      groupBy: "category",
      splitBy: null,
      buckets: [],
      total: 0,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("accountId=a1");
  });

  it("keeps only the categories the query names", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, ...MID_AUGUST }),
      transaction({ id: "t2", amount: 30, categoryId: "c2", ...MID_AUGUST }),
      transaction({ id: "t3", amount: 7, categoryId: null, ...MID_AUGUST }),
    ]);
    reportOnline(false);

    await expect(
      readSpending({ groupBy: "day", categoryIds: "c1,c2", ...AUGUST }),
    ).resolves.toEqual({
      groupBy: "day",
      splitBy: null,
      total: 40,
      buckets: [{ key: "2026-08-10", total: 40, count: 2, avg: 20 }],
    });
  });

  it("crosses a month with its categories, and declines the crossings the server refuses", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, ...MID_AUGUST }),
      transaction({ id: "t2", amount: 30, categoryId: "c2", ...MID_AUGUST }),
    ]);
    reportOnline(false);

    await expect(
      readSpending({ groupBy: "month", splitBy: "category", ...AUGUST }),
    ).resolves.toEqual({
      groupBy: "month",
      splitBy: "category",
      total: 40,
      buckets: [
        {
          key: "2026-08",
          total: 40,
          count: 2,
          avg: 20,
          splits: [
            { key: "c2", total: 30, count: 1, avg: 30 },
            { key: "c1", total: 10, count: 1, avg: 10 },
          ],
        },
      ],
    });

    // Days would grow a split per day of the window, and without a window there is no bound at all.
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ groupBy: "day", splitBy: null, buckets: [], total: 0 })),
    );
    reportOnline(true);
    await readSpending({ groupBy: "day", splitBy: "category", ...AUGUST });
    await readSpending({ groupBy: "month", splitBy: "category" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Every one of these is a 400 on the server, so answering it here would be answering another question.
  it.each([
    ["an unknown parameter", { accountId: "a1" }],
    ["a grouping it does not have", { groupBy: "week" }],
    ["a type it does not have", { type: "NONSENSE" }],
    ["a split it does not have", { splitBy: "account" }],
    ["a split over days", { groupBy: "day", splitBy: "category" }],
    ["a split with no window", { groupBy: "month", splitBy: "category", from: undefined }],
    ["a list of no categories", { categoryIds: "," }],
    ["a bound that is not a date", { from: "yesterday" }],
    ["an inverted window", { from: "2026-09-01T05:00:00.000Z", to: "2026-08-01T05:00:00.000Z" }],
  ])("declines %s instead of answering without it", async (_name, extra) => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ groupBy: "category", splitBy: null, buckets: [], total: 0 })),
    );
    await mirrorOf([
      transaction({ id: "t1", amount: 10, ...MID_AUGUST }),
      transaction({ id: "t2", amount: 30, categoryId: "c2", ...MID_AUGUST }),
    ]);

    await expect(
      readSpending({ ...AUGUST, ...(extra as Record<string, string | undefined>) }),
    ).resolves.toEqual({ groupBy: "category", splitBy: null, buckets: [], total: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("groups by the account the money left, or the one it reached", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, ...MID_AUGUST }),
      transaction({ id: "t2", amount: 30, fromAccountId: null, toAccountId: "a2", ...MID_AUGUST }),
      transaction({ id: "t3", amount: 5, fromAccountId: null, toAccountId: null, ...MID_AUGUST }),
    ]);
    reportOnline(false);

    // Income arrives, so it is keyed by where it landed even when the row also names where it left.
    await expect(readSpending({ groupBy: "account", type: "INCOME", ...AUGUST })).resolves.toEqual({
      groupBy: "account",
      splitBy: null,
      total: 0,
      buckets: [],
    });

    await expect(readSpending({ groupBy: "account", ...AUGUST })).resolves.toEqual({
      groupBy: "account",
      splitBy: null,
      total: 45,
      buckets: [
        { key: "a2", total: 30, count: 1, avg: 30 },
        { key: "a1", total: 10, count: 1, avg: 10 },
        { key: "unassigned", total: 5, count: 1, avg: 5 },
      ],
    });
  });

  it("keys income by the account it reached, even when the row names one it left", async () => {
    await mirrorOf([
      transaction({
        id: "t1",
        type: "INCOME",
        amount: 100,
        fromAccountId: "a1",
        toAccountId: "a2",
        ...MID_AUGUST,
      }),
    ]);
    reportOnline(false);

    await expect(readSpending({ groupBy: "account", type: "INCOME", ...AUGUST })).resolves.toEqual({
      groupBy: "account",
      splitBy: null,
      total: 100,
      buckets: [{ key: "a2", total: 100, count: 1, avg: 100 }],
    });
  });

  it("counts the whole history when the query carries no window", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, date: "2020-01-01T15:00:00.000Z" }),
      transaction({ id: "t2", amount: 30, date: "2030-01-01T15:00:00.000Z", categoryId: "c2" }),
    ]);
    reportOnline(false);

    await expect(readSpending({ groupBy: "category", type: "EXPENSE" })).resolves.toEqual({
      groupBy: "category",
      splitBy: null,
      total: 40,
      buckets: [
        { key: "c2", total: 30, count: 1, avg: 30 },
        { key: "c1", total: 10, count: 1, avg: 10 },
      ],
    });
  });

  it("leaves a deleted row out and keeps an ADJUSTMENT out of an untyped-by-URL query", async () => {
    await mirrorOf([
      transaction({ id: "t1", amount: 10, date: "2026-08-10T15:00:00.000Z" }),
      transaction({
        id: "t2",
        amount: 99,
        date: "2026-08-11T15:00:00.000Z",
        deletedAt: "2026-08-12T00:00:00.000Z",
      }),
      transaction({
        id: "t3",
        type: "ADJUSTMENT",
        amount: 77,
        date: "2026-08-11T15:00:00.000Z",
        categoryId: null,
      }),
    ]);
    reportOnline(false);

    await expect(readSpending({ groupBy: "category", ...AUGUST })).resolves.toEqual({
      groupBy: "category",
      splitBy: null,
      total: 10,
      buckets: [{ key: "c1", total: 10, count: 1, avg: 10 }],
    });
  });

  it("declines when the mirror has no profile to take the zone from", async () => {
    await mirrorOf([transaction({ id: "t1" })], null);
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readSpending({ groupBy: "day", type: "EXPENSE", ...AUGUST })).rejects.toThrow(
      "Network request failed",
    );
  });
});
