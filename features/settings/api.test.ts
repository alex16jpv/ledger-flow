import { pullChanges } from "@/lib/local/pull";
import { setCurrentVault } from "@/lib/local/repository";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, category, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Account, Category, SyncChangesResponse } from "@/types/api";

import { fetchAccountCount, fetchCategorySummary } from "./api";

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

function feed(accounts: Account[], categories: Category[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-06T12:00:00.000Z",
    changes: { user: null, accounts, categories, transactions: [], budgets: [] },
    pagination: { limit: 500, count: 0, hasMore: false, nextCursor: "v1|done|" },
  };
}

async function mirrorOf(accounts: Account[], categories: Category[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feed(accounts, categories)) });
  setCurrentVault(vault);
}

// F-43: the two figures of Settings were the last reads in `(app)` still going to the server, so the
// screen cost two requests with a full mirror and went blank with no network.
describe("the counts Settings shows", () => {
  it("counts the categories, archived ones included, from the mirror and with no network", async () => {
    await mirrorOf(
      [],
      [
        category({ id: "c1", name: "Dining", type: "EXPENSE" }),
        category({ id: "c2", name: "Salary", type: "INCOME" }),
        category({ id: "c3", name: "Gym", archivedAt: "2026-08-20T00:00:00.000Z" }),
      ],
    );
    reportOnline(false);

    const summary = await fetchCategorySummary();

    expect(summary.data.map((row) => row.id).sort()).toEqual(["c1", "c2", "c3"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers whether the user has accounts from the mirror, with no network", async () => {
    await mirrorOf([account({ id: "a1", name: "Cash" })], []);
    reportOnline(false);

    expect((await fetchAccountCount()).pagination.total).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers zero accounts when the mirror has none", async () => {
    await mirrorOf([], []);
    reportOnline(false);

    expect((await fetchAccountCount()).pagination.total).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
