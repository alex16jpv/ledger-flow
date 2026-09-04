import {
  account,
  budget,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { pullChanges, type PullPageQuery, SyncFeedStalledError } from "./pull";

type Changes = Partial<SyncChangesResponse["changes"]>;

function page(
  changes: Changes,
  pagination: { count: number; hasMore: boolean; nextCursor: string },
): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: {
      user: null,
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      ...changes,
    },
    pagination: { limit: 500, ...pagination },
  };
}

function feed(pages: SyncChangesResponse[]): {
  fetchPage: (query: PullPageQuery) => Promise<SyncChangesResponse>;
  queries: PullPageQuery[];
} {
  const queries: PullPageQuery[] = [];
  let index = 0;
  return {
    queries,
    fetchPage: (query) => {
      queries.push(query);
      const next = pages[index++];
      if (!next) throw new Error("the pull asked for one page too many");
      return Promise.resolve(next);
    },
  };
}

describe("pullChanges", () => {
  afterEach(wipeVaults);

  it("pages until hasMore is false and stores the cursor verbatim", async () => {
    const vault = await openTestVault("u1");
    const { fetchPage, queries } = feed([
      page({ accounts: [account({ id: "a1" })] }, { count: 1, hasMore: true, nextCursor: "c1" }),
      page(
        { categories: [category({ id: "c1" })], user: profile() },
        { count: 2, hasMore: true, nextCursor: "c2" },
      ),
      page(
        { transactions: [transaction({ id: "t1" })], budgets: [budget({ id: "b1" })] },
        { count: 2, hasMore: false, nextCursor: "v1|final|" },
      ),
    ]);

    const result = await pullChanges(vault, { fetchPage, limit: 500 });

    expect(result).toEqual({
      pages: 3,
      rows: 5,
      cursor: "v1|final|",
      serverTime: "2026-09-03T12:00:00.000Z",
    });
    expect(queries).toEqual([
      { cursor: undefined, limit: 500 },
      { cursor: "c1", limit: 500 },
      { cursor: "c2", limit: 500 },
    ]);
    expect(await vault.db.get("meta", "syncCursor")).toEqual({
      key: "syncCursor",
      value: "v1|final|",
    });
    expect(await vault.db.get("meta", "syncedAt")).toEqual({
      key: "syncedAt",
      value: "2026-09-03T12:00:00.000Z",
    });
    await expect(vault.db.count("accounts")).resolves.toBe(1);
    await expect(vault.db.count("categories")).resolves.toBe(1);
    await expect(vault.db.count("transactions")).resolves.toBe(1);
    await expect(vault.db.count("budgets")).resolves.toBe(1);
    expect((await vault.db.get("profile", "me"))?.row.id).toBe(profile().id);
  });

  it("writes each row exactly as the feed sent it", async () => {
    const vault = await openTestVault("u1");
    const row = transaction({ id: "t1", pendingDetails: true, tags: ["food"] });
    const { fetchPage } = feed([
      page({ transactions: [row] }, { count: 1, hasMore: false, nextCursor: "c1" }),
    ]);

    await pullChanges(vault, { fetchPage });

    expect((await vault.db.get("transactions", "t1"))?.row).toEqual(row);
  });

  it("resumes from the stored cursor instead of starting a snapshot", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("meta", { key: "syncCursor", value: "v1|kept|" });
    const { fetchPage, queries } = feed([
      page({}, { count: 0, hasMore: false, nextCursor: "v1|moved|" }),
    ]);

    await pullChanges(vault, { fetchPage, limit: 200 });

    expect(queries).toEqual([{ cursor: "v1|kept|", limit: 200 }]);
  });

  // D-14: the finished cursor sits 60 s behind serverTime, so the next run re-reads those rows.
  it("applies the overlap by id without duplicating or reverting anything", async () => {
    const vault = await openTestVault("u1");
    const first = account({ id: "a1", name: "Cash", updatedAt: "2026-09-01T00:00:00.000Z" });
    const again = account({ id: "a1", name: "Wallet", updatedAt: "2026-09-02T00:00:00.000Z" });
    await pullChanges(vault, {
      fetchPage: feed([page({ accounts: [first] }, { count: 1, hasMore: false, nextCursor: "c1" })])
        .fetchPage,
    });

    await pullChanges(vault, {
      fetchPage: feed([
        page({ accounts: [first, again] }, { count: 2, hasMore: false, nextCursor: "c2" }),
      ]).fetchPage,
    });

    await expect(vault.db.count("accounts")).resolves.toBe(1);
    expect((await vault.db.get("accounts", "a1"))?.row.name).toBe("Wallet");
  });

  it("leaves the mirror unreadable until the feed is drained", async () => {
    const vault = await openTestVault("u1");
    const { fetchPage } = feed([
      page({ accounts: [account()] }, { count: 1, hasMore: true, nextCursor: "c1" }),
    ]);

    await expect(pullChanges(vault, { fetchPage })).rejects.toThrow("one page too many");

    expect(await vault.db.get("meta", "syncCursor")).toEqual({ key: "syncCursor", value: "c1" });
    expect(await vault.db.get("meta", "syncedAt")).toBeUndefined();
  });

  it("stops when the feed asks for another page without moving the cursor", async () => {
    const vault = await openTestVault("u1");
    const { fetchPage } = feed([
      page({}, { count: 0, hasMore: true, nextCursor: "c1" }),
      page({}, { count: 0, hasMore: true, nextCursor: "c1" }),
    ]);

    await expect(pullChanges(vault, { fetchPage })).rejects.toBeInstanceOf(SyncFeedStalledError);
  });
});
