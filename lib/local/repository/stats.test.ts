import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { category, openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";
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
        changes: {
          user,
          accounts: [],
          categories: [category({ id: "c1" }), category({ id: "c2" })],
          transactions,
          budgets: [],
        },
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

describe("spending through the repository", () => {
  it("asks the server while online with the query the call site built", async () => {
    fetchMock.mockResolvedValue(json({ groupBy: "day", buckets: [], total: 0 }));
    await mirrorOf([]);

    await readSpending({ groupBy: "day", type: "EXPENSE", ...AUGUST });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/stats/spending?groupBy=day&type=EXPENSE&from=2026-08-01T05%3A00%3A00.000Z&to=2026-09-01T05%3A00%3A00.000Z",
    );
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
      total: 10,
      buckets: [{ key: "c1", total: 10, count: 1, avg: 10 }],
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
