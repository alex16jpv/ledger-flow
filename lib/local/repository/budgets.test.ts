import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import {
  budget,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type {
  Budget,
  Category,
  SyncBudget,
  SyncChangesResponse,
  SyncTransaction,
  User,
} from "@/types/api";

import { pullChanges } from "../pull";
import { readBudget, readBudgets, readBudgetsPage } from "./budgets";
import { setCurrentVault } from "./read";

const REFERENCE = "2026-09-03T12:00:00.000Z";

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

interface Seed {
  user?: User | null;
  categories?: Category[];
  transactions?: SyncTransaction[];
  budgets?: SyncBudget[];
}

async function mirrorOf(seed: Seed): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, {
    fetchPage: () =>
      Promise.resolve<SyncChangesResponse>({
        serverTime: REFERENCE,
        changes: {
          user: seed.user === undefined ? profile() : seed.user,
          accounts: [],
          categories: seed.categories ?? [category({ id: "c1" })],
          transactions: seed.transactions ?? [],
          budgets: seed.budgets ?? [],
        },
        pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "v1|done|" },
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
    await mirrorOf({ budgets: [dining] });

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([view]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/budgets?reference=2026-09-03T12%3A00%3A00.000Z&limit=100",
    );
  });

  it("builds the whole view offline, spent included", async () => {
    await mirrorOf({
      budgets: [dining],
      transactions: [
        transaction({ id: "t1", amount: 120.5, date: "2026-09-02T15:00:00.000Z" }),
        // Outside the September window in Bogota: 00:30 on the 1st local is still August in UTC.
        transaction({ id: "t2", amount: 90, date: "2026-09-01T04:30:00.000Z" }),
      ],
    });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([view]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports 0 for a budget with no spend rather than leaving the figure out", async () => {
    await mirrorOf({ budgets: [dining] });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([{ ...view, spent: 0 }]);
  });

  it("counts an archived category of the budget without dropping its spend", async () => {
    await mirrorOf({
      budgets: [dining],
      categories: [category({ id: "c1", archivedAt: "2026-08-20T00:00:00.000Z" })],
      transactions: [transaction({ id: "t1", amount: 120.5, date: "2026-09-02T15:00:00.000Z" })],
    });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([
      { ...view, archivedCategoryIds: ["c1"] },
    ]);
  });

  it("leaves an archived budget out of the list but still answers its detail", async () => {
    const retired = budget({ id: "b2", name: "Retired", archivedAt: "2026-08-01T00:00:00.000Z" });
    await mirrorOf({ budgets: [dining, retired] });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toMatchObject([{ id: "b1" }]);
    await expect(
      readBudgets({ reference: REFERENCE, includeArchived: true }),
    ).resolves.toMatchObject([{ id: "b1" }, { id: "b2" }]);
    await expect(readBudget("b2", REFERENCE)).resolves.toMatchObject({ id: "b2", spent: 0 });
  });

  it("hides an expired CUSTOM budget unless the caller asks for it", async () => {
    const trip = budget({
      id: "b2",
      name: "Trip",
      periodType: "CUSTOM",
      periodStartDate: "2026-07-01T05:00:00.000Z",
      periodEndDate: "2026-08-01T05:00:00.000Z",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    });
    await mirrorOf({ budgets: [trip] });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([]);
    await expect(
      readBudgets({ reference: REFERENCE, includeExpired: true }),
    ).resolves.toMatchObject([{ id: "b2", expired: true }]);
  });

  // The lifetime floor drops the period, not the budget: a September reference on a budget that
  // only starts in October has nothing to show.
  it("drops a period that closes on or before the budget's lifetime floor", async () => {
    await mirrorOf({
      budgets: [budget({ id: "b1", effectiveFrom: "2026-10-01T05:00:00.000Z" })],
    });
    reportOnline(false);

    await expect(readBudgets({ reference: REFERENCE })).resolves.toEqual([]);
  });

  // The server counts the page before the view filters thin it, so a short page is not the end.
  it("pages the stored rows and counts them before the view filters run", async () => {
    const trip = budget({
      id: "b2",
      periodType: "CUSTOM",
      periodStartDate: "2026-07-01T05:00:00.000Z",
      periodEndDate: "2026-08-01T05:00:00.000Z",
    });
    await mirrorOf({ budgets: [dining, trip] });
    reportOnline(false);

    const page = await readBudgetsPage({ reference: REFERENCE, limit: 2 });
    expect(page.pagination).toEqual({
      limit: 2,
      offset: 0,
      total: 2,
      hasMore: false,
      nextCursor: null,
    });
    expect(page.data).toMatchObject([{ id: "b1" }]);
  });

  it("declines every read when the mirror has no profile to take the zone from", async () => {
    await mirrorOf({ user: null, budgets: [dining] });
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readBudgets({ reference: REFERENCE })).rejects.toThrow("Network request failed");
    await expect(readBudgetsPage({ reference: REFERENCE })).rejects.toThrow(
      "Network request failed",
    );
    await expect(readBudget("b1", REFERENCE)).rejects.toThrow("Network request failed");
  });

  it("declines a detail it never stored so the server answers the 404", async () => {
    await mirrorOf({ budgets: [dining] });
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readBudget("missing", REFERENCE)).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
