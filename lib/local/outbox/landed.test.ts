import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, applied } from "@/lib/testing/sync";
import {
  account,
  changes as feedChanges,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import type { VaultHandle } from "../db";
import { pullChanges } from "../pull";
import { readAccounts } from "../repository/accounts";
import { setCurrentVault } from "../repository/read";
import { accountRecord, profileRecord } from "../schema";
import { requestSync, resetSyncEngine } from "./engine";
import { readLanded } from "./landed";
import { pendingOperations } from "./queue";
import { outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";
import { createTransaction } from "./transactions";

const fetchMock = vi.fn<typeof fetch>();
const T0 = "2026-08-01T10:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";
const cash = account({ id: "a1", name: "Cash", balance: 1000, openingBalance: 1000 });
const coffee = {
  id: "t2",
  type: "EXPENSE" as const,
  amount: 50,
  date: "2026-09-04T11:00:00.000Z",
  categoryId: "c1",
  fromAccountId: "a1",
  toAccountId: null,
  description: "Coffee",
  tags: [],
  note: null,
};
const served = transaction({ ...coffee, updatedAt: T1 });
const spent = { ...cash, balance: 950, updatedAt: T1 };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await resetSyncEngine();
  resetOutboxStatus();
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

async function vaultWith() {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(cash));
  await vault.db.put("meta", { key: "syncedAt", value: T0 });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const feedOf = (rows: Partial<SyncChangesResponse["changes"]>): SyncChangesResponse => ({
  serverTime: T1,
  changes: feedChanges(rows),
  pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "c1" },
});

const balance = async () => (await readAccounts()).data.find((row) => row.id === "a1")?.balance;

// The expense went out with no pull behind it yet: the mirror still holds the old balance.
async function settledExpense(answer = served as unknown) {
  const vault = await vaultWith();
  reportOnline(false);
  await createTransaction(coffee, "t2");
  answerBatch(fetchMock, () => applied(answer));
  reportOnline(true);
  await requestSync();
  expect(await pendingOperations(vault.db)).toEqual([]);
  expect((await vault.db.get("accounts", "a1"))?.row.balance).toBe(1000);
  return vault;
}

const pull = (vault: VaultHandle, page: SyncChangesResponse) =>
  pullChanges(vault, { fetchPage: () => Promise.resolve(page) });

describe("a write the server applied, before a pull brings its balance (T-260)", () => {
  it("keeps the expense counted, and the balance marked as projected", async () => {
    await settledExpense();

    expect(await balance()).toBe(950);
    expect(outboxStatusStore.getSnapshot()).toMatchObject({
      pending: 0,
      projected: { balances: true },
    });
  });

  it("counts it once when the pull brings the balance, and stops marking it", async () => {
    const vault = await settledExpense();

    const result = await pull(vault, feedOf({ transactions: [served], accounts: [spent] }));
    await refreshOutboxStatus(vault.db);

    expect(result).toMatchObject({ changed: true, landed: true });
    expect(await balance()).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
    expect(outboxStatusStore.getSnapshot().projected.balances).toBe(false);
  });

  it("keeps it counted while the pull that would bring the balance fails", async () => {
    const vault = await settledExpense();

    await expect(
      pullChanges(vault, { fetchPage: () => Promise.reject(new Error("offline")) }),
    ).rejects.toThrow("offline");

    expect(await balance()).toBe(950);
  });

  it("lets a pull that began before the answer go by without the row", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    answerBatch(fetchMock, () => applied(served));
    reportOnline(true);

    await pullChanges(vault, {
      fetchPage: async () => {
        await requestSync();
        return feedOf({});
      },
    });

    expect(await balance()).toBe(950);
  });

  it("lets go when a pull that began before the answer brings the row read after it", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    answerBatch(fetchMock, () => applied(served));
    reportOnline(true);

    await pullChanges(vault, {
      fetchPage: async () => {
        await requestSync();
        return feedOf({ transactions: [served], accounts: [spent] });
      },
    });

    expect(await balance()).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
  });

  it("lets go of an answer with no row once a pull that began after it has finished", async () => {
    const vault = await settledExpense(undefined);

    await pull(vault, feedOf({ accounts: [spent] }));

    expect(await balance()).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
  });

  it("keeps nothing for a write the feed had already brought before it settled (T-162)", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    await createTransaction(coffee, "t2");
    await pull(vault, feedOf({ transactions: [served], accounts: [spent] }));
    answerBatch(fetchMock, () => applied(served));
    reportOnline(true);
    await requestSync();

    expect(await readLanded(vault.db)).toEqual([]);
    expect(await balance()).toBe(950);
  });

  it("counts it when a loan is judged: a payment past zero is refused", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "accounts",
      accountRecord(account({ id: "l1", type: "LOAN", balance: -100 })),
    );
    reportOnline(false);
    const payment = { ...coffee, type: "TRANSFER" as const, amount: 100, toAccountId: "l1" };
    await createTransaction(payment, "t2");
    answerBatch(fetchMock, () => applied(transaction({ ...payment, updatedAt: T1 })));
    reportOnline(true);
    await requestSync();
    reportOnline(false);

    await expect(
      createTransaction({ ...payment, id: "t3", amount: 10 }, "t3"),
    ).rejects.toMatchObject({ code: "LOAN_OVERPAID" });
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});
