import { pullChanges } from "@/lib/local/pull";
import { setCurrentVault } from "@/lib/local/repository";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, category, openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse, SyncTransaction, Transaction } from "@/types/api";

import {
  fetchHomeAccounts,
  fetchHomeBudgets,
  fetchHomeCategories,
  fetchHomePending,
  fetchSpending,
} from "./api";

const cash = account({ id: "a1", name: "Cash" });
const gone = account({ id: "a2", name: "Old card", archivedAt: "2026-08-20T00:00:00.000Z" });
const dining = category({ id: "c1", name: "Dining" });
const gym = category({ id: "c2", name: "Gym", archivedAt: "2026-08-20T00:00:00.000Z" });
const pending = transaction({ id: "t1", amount: 0.1, pendingDetails: true });
const alsoPending = transaction({
  id: "t2",
  amount: 0.2,
  pendingDetails: true,
  date: "2026-08-02T10:00:00.000Z",
});
const settled = transaction({ id: "t3", amount: 19.99 });

function apiRow(row: SyncTransaction): Transaction {
  const copy: Transaction & { deletedAt?: string | null } = { ...row };
  delete copy.deletedAt;
  return copy;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  const vault = await openTestVault("u1");
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve<SyncChangesResponse>({
        serverTime: "2026-09-03T12:00:00.000Z",
        changes: {
          user: null,
          accounts: [cash, gone],
          categories: [dining, gym],
          transactions: [pending, alsoPending, settled],
          budgets: [],
        },
        pagination: { limit: 500, count: 7, hasMore: false, nextCursor: "v1|done|" },
      }),
  });
  setCurrentVault(vault);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

describe("home reads", () => {
  it("answers accounts, categories and the pending tray the same online and offline", async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.startsWith("/api/accounts"))
        return Promise.resolve(
          json({
            data: [cash],
            pagination: { limit: 100, offset: 0, total: 1, hasMore: false, nextCursor: null },
          }),
        );
      if (url.startsWith("/api/categories"))
        return Promise.resolve(
          json({
            data: [dining, gym],
            pagination: { limit: 100, offset: 0, total: 2, hasMore: false, nextCursor: null },
          }),
        );
      return Promise.resolve(
        json({
          data: [apiRow(alsoPending)],
          pagination: { limit: 1, offset: 0, total: 2, hasMore: true, nextCursor: "t2" },
          summary: { totalAmount: 0.3 },
        }),
      );
    });

    const online = {
      accounts: await fetchHomeAccounts(),
      categories: await fetchHomeCategories(),
      pending: await fetchHomePending(),
    };
    expect(fetchMock.mock.calls.map((call) => urlOf(call[0]))).toEqual([
      "/api/accounts?limit=100",
      "/api/categories?includeArchived=true&limit=100",
      "/api/transactions?pendingDetails=true&limit=1&includeSummary=true",
    ]);

    reportOnline(false);
    fetchMock.mockReset();

    expect(await fetchHomeAccounts()).toEqual(online.accounts);
    expect(await fetchHomeCategories()).toEqual(online.categories);
    expect(await fetchHomePending()).toEqual(online.pending);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the archived accounts out of the list and the archived categories in the map", async () => {
    reportOnline(false);

    expect((await fetchHomeAccounts()).data).toEqual([cash]);
    expect((await fetchHomeCategories()).data).toEqual([dining, gym]);
  });

  // The month's buckets and every budget's `spent` are derived money (O-F3), so Home cannot be
  // served locally yet: these two must reach the server rather than answer with made-up figures.
  it("still asks the server for the spending and the budgets", async () => {
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      fetchSpending({ from: "2026-09-01", to: "2026-10-01", type: "EXPENSE", groupBy: "day" }),
    ).rejects.toThrow("Network request failed");
    await expect(fetchHomeBudgets("2026-09-03T12:00:00.000Z")).rejects.toThrow(
      "Network request failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
