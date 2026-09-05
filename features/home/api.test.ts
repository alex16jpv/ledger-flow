import type { VaultHandle } from "@/lib/local/db";
import { pullChanges } from "@/lib/local/pull";
import { setCurrentVault } from "@/lib/local/repository";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  account,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SyncChangesResponse, SyncTransaction, Transaction, User } from "@/types/api";

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

function feedPage(user: User | null): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: {
      user,
      accounts: [cash, gone],
      categories: [dining, gym],
      transactions: [pending, alsoPending, settled],
      budgets: [],
    },
    pagination: { limit: 500, count: 7, hasMore: false, nextCursor: "v1|done|" },
  };
}

let vault: VaultHandle;

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(null)) });
  setCurrentVault(vault);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

describe("home reads", () => {
  // O-F2b: Home reads the mirror with network too, and what it answers is what the three endpoints
  // answer. The URLs are still asserted because they are what a device with no snapshot falls back
  // to on its first load, and getting one wrong would only show up there.
  it("answers accounts, categories and the pending tray from the mirror, with network", async () => {
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

    const local = {
      accounts: await fetchHomeAccounts(),
      categories: await fetchHomeCategories(),
      pending: await fetchHomePending(),
    };
    expect(fetchMock).not.toHaveBeenCalled();

    setCurrentVault(null);
    const served = {
      accounts: await fetchHomeAccounts(),
      categories: await fetchHomeCategories(),
      pending: await fetchHomePending(),
    };
    expect(fetchMock.mock.calls.map((call) => urlOf(call[0]))).toEqual([
      "/api/accounts?limit=100",
      "/api/categories?includeArchived=true&limit=100",
      "/api/transactions?pendingDetails=true&limit=1&includeSummary=true",
    ]);

    expect(local).toEqual(served);
  });

  it("keeps the archived accounts out of the list and the archived categories in the map", async () => {
    reportOnline(false);

    expect((await fetchHomeAccounts()).data).toEqual([cash]);
    expect((await fetchHomeCategories()).data).toEqual([dining, gym]);
  });

  // The month's buckets and every budget's `spent` are derived money (O-F3), and the zone they are
  // cut on comes from the profile: with no profile in the mirror there is nothing to derive with,
  // and the server answers rather than the mirror inventing a figure.
  it("asks the server for the spending and the budgets while the mirror has no profile", async () => {
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

  it("derives both once the profile has arrived, network or not", async () => {
    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(profile())) });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const spending = await fetchSpending({
      from: "2026-08-01T05:00:00.000Z",
      to: "2026-10-01T05:00:00.000Z",
      type: "EXPENSE",
      groupBy: "day",
    });

    expect(spending.total).toBe(20.29);
    await expect(fetchHomeBudgets("2026-09-03T12:00:00.000Z")).resolves.toEqual({
      data: [],
      pagination: { limit: 100, offset: 0, total: 0, hasMore: false, nextCursor: null },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
