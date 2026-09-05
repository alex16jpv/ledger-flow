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

import type { VaultHandle } from "./db";
import { pullChanges, type PullPageQuery, SyncFeedStalledError } from "./pull";
import type { OutboxOperation } from "./schema";

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

const QUEUED = "2026-09-03T11:00:00.000Z";

async function queue(vault: VaultHandle, overrides: Partial<OutboxOperation>): Promise<void> {
  await vault.db.put("outbox", {
    seq: 1,
    opId: "op-1",
    opVersion: 1,
    entity: "transaction",
    entityId: "t1",
    action: "update",
    occurredAt: QUEUED,
    payload: {},
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    ...overrides,
  });
}

// D-23 (F-25): the feed is authoritative for the row, and what the queue has not sent yet is
// projected back on top of it — otherwise a pull undoes an edit made with no network.
describe("a pull with operations still queued", () => {
  afterEach(wipeVaults);

  it("keeps a movement deleted with no network deleted", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { action: "delete" });
    const { fetchPage } = feed([
      page(
        { transactions: [transaction({ id: "t1", deletedAt: null })] },
        { count: 1, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    const record = await vault.db.get("transactions", "t1");
    expect(record?.row.deletedAt).toBe(QUEUED);
    expect(record?.deleted).toBe(1);
    expect(record?.liveDate).toBeUndefined();
  });

  it("keeps an edit made with no network on top of the other device's row", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, {
      payload: { body: { amount: 90 } },
      baseUpdatedAt: "2026-08-01T10:00:00.000Z",
    });
    const server = transaction({
      id: "t1",
      amount: 42,
      description: "From the other device",
      updatedAt: "2026-09-03T09:00:00.000Z",
    });
    const { fetchPage } = feed([
      page({ transactions: [server] }, { count: 1, hasMore: false, nextCursor: "c1" }),
    ]);

    await pullChanges(vault, { fetchPage });

    const record = await vault.db.get("transactions", "t1");
    expect(record?.row.amount).toBe(90);
    // Everything the operation did not ask to change is the server's, the stamp included: the guard
    // the next write reads has to be the one the server printed (invariant 2).
    expect(record?.row.description).toBe("From the other device");
    expect(record?.updatedAt).toBe("2026-09-03T09:00:00.000Z");
  });

  it("shows the server's row for an operation that will never be sent", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { status: "conflict", payload: { body: { amount: 90 } } });
    await queue(vault, { seq: 2, opId: "op-2", status: "failed", action: "delete" });
    const { fetchPage } = feed([
      page(
        { transactions: [transaction({ id: "t1", amount: 42 })] },
        { count: 1, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    const record = await vault.db.get("transactions", "t1");
    expect(record?.row.amount).toBe(42);
    expect(record?.row.deletedAt).toBeNull();
  });

  it("re-archives an account the queue has not archived on the server yet", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { entity: "account", entityId: "a1", action: "archive" });
    const { fetchPage } = feed([
      page(
        { accounts: [account({ id: "a1", archivedAt: null })] },
        { count: 1, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    const record = await vault.db.get("accounts", "a1");
    expect(record?.row.archivedAt).toBe(QUEUED);
    expect(record?.archived).toBe(1);
  });

  it("leaves one default account when the queue is moving the flag", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { entity: "account", entityId: "a2", action: "setDefault" });
    const { fetchPage } = feed([
      page(
        {
          accounts: [
            account({ id: "a1", isDefault: true }),
            account({ id: "a2", name: "Bank", isDefault: false }),
          ],
        },
        { count: 2, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    expect((await vault.db.get("accounts", "a1"))?.row.isDefault).toBe(false);
    expect((await vault.db.get("accounts", "a2"))?.row.isDefault).toBe(true);
  });

  it("hands the flag to the last of two queued setDefault operations, and to no one else", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { entity: "account", entityId: "a2", action: "setDefault" });
    await queue(vault, {
      seq: 2,
      opId: "op-2",
      entity: "account",
      entityId: "a3",
      action: "setDefault",
    });
    const { fetchPage } = feed([
      page(
        {
          accounts: [
            account({ id: "a1", isDefault: true }),
            account({ id: "a2", name: "Bank", isDefault: false }),
            account({ id: "a3", name: "Wallet", isDefault: false }),
          ],
        },
        { count: 3, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    const flags = await Promise.all(
      ["a1", "a2", "a3"].map(async (id) => (await vault.db.get("accounts", id))?.row.isDefault),
    );
    expect(flags).toEqual([false, false, true]);
  });

  it("lets the server complete a quick capture and keeps the details queued behind it", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { action: "quickAdd", payload: { body: { id: "t1", amount: 10 } } });
    await queue(vault, {
      seq: 2,
      opId: "op-2",
      payload: { body: { description: "Coffee", pendingDetails: false } },
    });
    const { fetchPage } = feed([
      page(
        { transactions: [transaction({ id: "t1", amount: 10, pendingDetails: true })] },
        { count: 1, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    const record = await vault.db.get("transactions", "t1");
    expect(record?.row).toMatchObject({ pendingDetails: false, description: "Coffee" });
    expect(record?.pendingReview).toBeUndefined();
    // The server's own row stays aside for the sheet and the next reconciliation (D-24).
    expect(record?.server).toMatchObject({ pendingDetails: true, description: null });
  });

  it("keeps no baseline for a row the queue does not touch", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, { action: "delete" });
    const { fetchPage } = feed([
      page(
        { transactions: [transaction({ id: "t1" }), transaction({ id: "t2" })] },
        { count: 2, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    expect((await vault.db.get("transactions", "t1"))?.server).toBeDefined();
    expect((await vault.db.get("transactions", "t2"))?.server).toBeUndefined();
  });

  it("keeps a budget override the queue has not sent, resolved in the owner's zone", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("profile", {
      id: "me",
      row: profile(),
      updatedAt: profile().updatedAt,
    });
    await queue(vault, {
      entity: "budget",
      entityId: "b1",
      action: "setOverride",
      payload: { query: { reference: "2026-09-10T00:00:00.000Z" }, body: { amount: 500 } },
    });
    const { fetchPage } = feed([
      page({ budgets: [budget({ id: "b1" })] }, { count: 1, hasMore: false, nextCursor: "c1" }),
    ]);

    await pullChanges(vault, { fetchPage });

    const overrides = (await vault.db.get("budgets", "b1"))?.row.amountOverrides ?? {};
    expect(Object.values(overrides)).toEqual([500]);
  });

  it("lets the server's row win for a create whose answer was lost", async () => {
    const vault = await openTestVault("u1");
    await queue(vault, {
      action: "create",
      payload: { body: { id: "t1", amount: 10, type: "EXPENSE", date: QUEUED } },
    });
    const { fetchPage } = feed([
      page(
        { transactions: [transaction({ id: "t1", amount: 10, description: "Named there" })] },
        { count: 1, hasMore: false, nextCursor: "c1" },
      ),
    ]);

    await pullChanges(vault, { fetchPage });

    expect((await vault.db.get("transactions", "t1"))?.row.description).toBe("Named there");
  });
});
