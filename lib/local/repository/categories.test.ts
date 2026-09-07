import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { category, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Category, CategoryList, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readCategories, readCategoriesPage, readCategory } from "./categories";
import { setCurrentVault } from "./read";

const dining = category({ id: "c1", name: "Dining", type: "EXPENSE" });
const salary = category({ id: "c2", name: "Salary", type: "INCOME" });
const gym = category({
  id: "c3",
  name: "Gym",
  type: "EXPENSE",
  archivedAt: "2026-08-20T00:00:00.000Z",
});

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

function feedPage(categories: Category[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: { user: null, accounts: [], categories, transactions: [], budgets: [] },
    pagination: { limit: 500, count: categories.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

async function mirrorOf(categories: Category[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(categories)) });
  setCurrentVault(vault);
}

const page = (data: Category[]): CategoryList => ({
  data,
  pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
});

describe("categories through the repository", () => {
  // O-F2b: the mirror answers with network too, and the answer is the server's own, byte for byte.
  it("asks the server until a pull has drained and reads the mirror from then on", async () => {
    fetchMock.mockResolvedValue(json(page([dining, gym])));
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    const filters = { type: "EXPENSE", includeArchived: true } as const;
    const beforeSnapshot = await readCategories(filters);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/categories?type=EXPENSE&includeArchived=true&limit=100",
    );

    await pullChanges(vault, {
      fetchPage: () => Promise.resolve(feedPage([dining, salary, gym])),
    });
    fetchMock.mockClear();
    const online = await readCategories(filters);

    reportOnline(false);
    const offline = await readCategories(filters);

    expect(beforeSnapshot).toEqual([dining, gym]);
    expect(online).toEqual([dining, gym]);
    expect(offline).toEqual([dining, gym]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides the archived ones and keeps every type when none is asked for", async () => {
    await mirrorOf([dining, salary, gym]);
    reportOnline(false);

    await expect(readCategories()).resolves.toEqual([dining, salary]);
    await expect(readCategories({ type: "INCOME" })).resolves.toEqual([salary]);
  });

  it("pages the mirror the way the API pages the list", async () => {
    fetchMock.mockResolvedValue(json(page([dining, salary])));
    await mirrorOf([dining, salary, gym]);

    expect(await readCategoriesPage({ limit: 100 })).toEqual(page([dining, salary]));
    await expect(readCategoriesPage({ includeArchived: true, limit: 2 })).resolves.toEqual({
      data: [dining, salary],
      pagination: { limit: 2, offset: 0, total: 3, hasMore: true, nextCursor: "c2" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads one category from the mirror, archived included", async () => {
    await mirrorOf([dining, gym]);
    reportOnline(false);

    await expect(readCategory("c3")).resolves.toEqual(gym);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the server for a category the mirror never saw", async () => {
    await mirrorOf([dining]);
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readCategory("c9")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
