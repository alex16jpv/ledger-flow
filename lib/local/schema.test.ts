import {
  account,
  budget,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";

import { VAULT_SCHEMA_VERSION } from "./db";
import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  PROFILE_KEY,
  profileRecord,
  transactionRecord,
  vaultDatabaseName,
} from "./schema";

describe("vault schema", () => {
  afterEach(wipeVaults);

  it("names one database per user", () => {
    expect(vaultDatabaseName("u1")).toBe("lf-vault-u1");
    expect(vaultDatabaseName("u2")).toBe("lf-vault-u2");
  });

  it("creates every store and index at the current version", async () => {
    const vault = await openTestVault("u1");
    const { db } = vault;

    expect(db.version).toBe(VAULT_SCHEMA_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([
      "accounts",
      "budgets",
      "categories",
      "meta",
      "outbox",
      "profile",
      "transactions",
    ]);

    const tx = db.transaction(["transactions", "outbox", "accounts"]);
    expect([...tx.objectStore("transactions").indexNames].sort()).toEqual([
      "categoryId",
      "date",
      "dateCursor",
      "deleted",
      "fromAccountId",
      "pendingReview",
      "toAccountId",
      "updatedAt",
    ]);
    expect([...tx.objectStore("outbox").indexNames].sort()).toEqual(["entity", "opId", "status"]);
    expect([...tx.objectStore("accounts").indexNames].sort()).toEqual(["archived", "updatedAt"]);
    await tx.done;
  });

  it("stamps the user id and the two logical versions on a fresh vault", async () => {
    const vault = await openTestVault("u1");
    expect(await vault.db.get("meta", "userId")).toEqual({ key: "userId", value: "u1" });
    expect(await vault.db.get("meta", "mirrorVersion")).toEqual({
      key: "mirrorVersion",
      value: 1,
    });
    expect(await vault.db.get("meta", "outboxVersion")).toEqual({
      key: "outboxVersion",
      value: 1,
    });
  });

  it("keeps two users apart in separate databases", async () => {
    const first = await openTestVault("u1");
    await first.db.put("accounts", accountRecord(account({ id: "a1", name: "Mine" })));

    const second = await openTestVault("u2");
    expect(await second.db.count("accounts")).toBe(0);

    const again = await openTestVault("u1");
    expect((await again.db.get("accounts", "a1"))?.row.name).toBe("Mine");
  });

  it("stores each row exactly as the sync feed sent it", async () => {
    const vault = await openTestVault("u1");
    const row = transaction({ id: "t1", tags: ["food", "trip"], note: "kept" });
    await vault.db.put("transactions", transactionRecord(row));
    expect((await vault.db.get("transactions", "t1"))?.row).toEqual(row);
  });

  it("indexes the profile under a single key", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("profile", profileRecord(profile({ name: "First" })));
    await vault.db.put("profile", profileRecord(profile({ name: "Second" })));
    expect(await vault.db.count("profile")).toBe(1);
    expect((await vault.db.get("profile", PROFILE_KEY))?.row.name).toBe("Second");
  });

  it("applies by id with upsert, so the cursor overlap costs nothing", async () => {
    const vault = await openTestVault("u1");
    const row = transaction({ id: "t1", amount: 10 });
    await vault.db.put("transactions", transactionRecord(row));
    await vault.db.put("transactions", transactionRecord(row));
    await vault.db.put("transactions", transactionRecord({ ...row, amount: 12 }));
    expect(await vault.db.count("transactions")).toBe(1);
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(12);
  });
});

describe("mirror index keys", () => {
  afterEach(wipeVaults);

  it("marks archived rows with a number, because IndexedDB will not index a boolean", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account({ id: "a1", archivedAt: null })));
    await vault.db.put(
      "accounts",
      accountRecord(account({ id: "a2", archivedAt: "2026-08-01T00:00:00.000Z" })),
    );
    await vault.db.put("categories", categoryRecord(category({ id: "c1", archivedAt: null })));
    await vault.db.put(
      "budgets",
      budgetRecord(budget({ id: "b1", archivedAt: "2026-08-01T00:00:00.000Z" })),
    );

    expect(await vault.db.getAllKeysFromIndex("accounts", "archived", 0)).toEqual(["a1"]);
    expect(await vault.db.getAllKeysFromIndex("accounts", "archived", 1)).toEqual(["a2"]);
    expect(await vault.db.getAllKeysFromIndex("categories", "archived", 0)).toEqual(["c1"]);
    expect(await vault.db.getAllKeysFromIndex("budgets", "archived", 1)).toEqual(["b1"]);
  });

  it("keeps tombstones out of the date cursor but still reachable by id", async () => {
    const vault = await openTestVault("u1");
    const alive = transaction({ id: "t1", date: "2026-08-01T10:00:00.000Z" });
    const gone = transaction({
      id: "t2",
      date: "2026-08-02T10:00:00.000Z",
      deletedAt: "2026-08-03T00:00:00.000Z",
    });
    await vault.db.put("transactions", transactionRecord(alive));
    await vault.db.put("transactions", transactionRecord(gone));

    expect(await vault.db.getAllKeysFromIndex("transactions", "dateCursor")).toEqual(["t1"]);
    expect(await vault.db.getAllKeysFromIndex("transactions", "deleted", 1)).toEqual(["t2"]);
    expect(await vault.db.get("transactions", "t2")).toBeDefined();
    expect(await vault.db.count("transactions")).toBe(2);
  });

  it("orders the date cursor by (date, id) so equal dates never tie", async () => {
    const vault = await openTestVault("u1");
    for (const [id, date] of [
      ["t3", "2026-08-02T10:00:00.000Z"],
      ["t1", "2026-08-01T10:00:00.000Z"],
      ["t2", "2026-08-01T10:00:00.000Z"],
    ] as const) {
      await vault.db.put("transactions", transactionRecord(transaction({ id, date })));
    }
    expect(await vault.db.getAllKeysFromIndex("transactions", "dateCursor")).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("indexes only rows that still need review, and drops deleted ones from that index", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put(
      "transactions",
      transactionRecord(transaction({ id: "t1", pendingDetails: true })),
    );
    await vault.db.put(
      "transactions",
      transactionRecord(transaction({ id: "t2", pendingDetails: false })),
    );
    await vault.db.put(
      "transactions",
      transactionRecord(
        transaction({ id: "t3", pendingDetails: true, deletedAt: "2026-08-03T00:00:00.000Z" }),
      ),
    );
    expect(await vault.db.getAllKeysFromIndex("transactions", "pendingReview")).toEqual(["t1"]);
  });

  it("omits null foreign keys instead of indexing them", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put(
      "transactions",
      transactionRecord(
        transaction({ id: "t1", categoryId: "c1", fromAccountId: "a1", toAccountId: null }),
      ),
    );
    await vault.db.put(
      "transactions",
      transactionRecord(
        transaction({ id: "t2", categoryId: null, fromAccountId: null, toAccountId: "a2" }),
      ),
    );

    expect(await vault.db.getAllKeysFromIndex("transactions", "categoryId")).toEqual(["t1"]);
    expect(await vault.db.getAllKeysFromIndex("transactions", "fromAccountId", "a1")).toEqual([
      "t1",
    ]);
    expect(await vault.db.getAllKeysFromIndex("transactions", "toAccountId", "a2")).toEqual(["t2"]);
    const stored = await vault.db.get("transactions", "t2");
    expect(stored?.row.categoryId).toBeNull();
    expect(stored).not.toHaveProperty("categoryId");
  });

  it("orders by updatedAt, which is how the pull applies a page", async () => {
    const vault = await openTestVault("u1");
    for (const [id, updatedAt] of [
      ["a2", "2026-08-02T00:00:00.000Z"],
      ["a1", "2026-08-01T00:00:00.000Z"],
      ["a3", "2026-08-03T00:00:00.000Z"],
    ] as const) {
      await vault.db.put("accounts", accountRecord(account({ id, updatedAt })));
    }
    expect(await vault.db.getAllKeysFromIndex("accounts", "updatedAt")).toEqual(["a1", "a2", "a3"]);
  });
});
