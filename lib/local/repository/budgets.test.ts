import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { budget, category, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Budget, SyncBudget, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readBudget, readBudgets, readBudgetsPage } from "./budgets";
import { setCurrentVault } from "./read";

const dining = budget({ id: "b1", name: "Dining" });

const view: Budget = {
  id: "b1",
  name: "Dining",
  color: "ORANGE",
  categoryIds: ["c1"],
  archivedCategoryIds: [],
  type: "EXPENSE",
  currency: "COP",
  periodType: "MONTHLY",
  periodKey: "2026-09",
  periodFrom: "2026-09-01T05:00:00.000Z",
  periodTo: "2026-10-01T05:00:00.000Z",
  baseAmount: 400,
  amount: 400,
  spent: 120.5,
  hasOverride: false,
  expired: false,
  effectiveFrom: "2026-08-01T00:00:00.000Z",
  note: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

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

async function mirrorOf(budgets: SyncBudget[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve<SyncChangesResponse>({
        serverTime: "2026-09-03T12:00:00.000Z",
        changes: {
          user: null,
          accounts: [],
          categories: [category({ id: "c1" })],
          transactions: [],
          budgets,
        },
        pagination: { limit: 500, count: budgets.length, hasMore: false, nextCursor: "v1|done|" },
      }),
  });
  setCurrentVault(vault);
}

describe("budgets through the repository", () => {
  it("reads the list from the server while online", async () => {
    fetchMock.mockResolvedValue(
      json({
        data: [view],
        pagination: { limit: 100, offset: 0, total: 1, hasMore: false, nextCursor: null },
      }),
    );
    await mirrorOf([dining]);

    await expect(readBudgets({ reference: "2026-09-03T12:00:00.000Z" })).resolves.toEqual([view]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/budgets?reference=2026-09-03T12%3A00%3A00.000Z&limit=100",
    );
  });

  // The mirror holds the budget but not its `spent`, and every budget surface reads that figure:
  // declining sends the read to the server, which fails honestly instead of inventing a number.
  it("declines the list offline instead of answering without the derived spent", async () => {
    await mirrorOf([dining]);
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readBudgets()).rejects.toThrow("Network request failed");
    await expect(readBudgetsPage({ reference: "2026-09-03T12:00:00.000Z" })).rejects.toThrow(
      "Network request failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("declines the detail offline even for a budget it has stored", async () => {
    await mirrorOf([dining]);
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readBudget("b1")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect((await openTestVault("u1")).db.get("budgets", "b1")).resolves.toMatchObject({
      id: "b1",
    });
  });
});
