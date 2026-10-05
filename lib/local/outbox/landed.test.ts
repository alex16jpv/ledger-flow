import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, applied } from "@/lib/testing/sync";
import {
  account,
  changes as feedChanges,
  openTestVault,
  profile,
  settlement,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { Restamp, SyncChangesResponse } from "@/types/api";

import type { VaultHandle } from "../db";
import { pullChanges } from "../pull";
import { purgeVault } from "../purge";
import { readAccounts } from "../repository/accounts";
import { setCurrentVault } from "../repository/read";
import { accountRecord, profileRecord } from "../schema";
import { updateAccount } from "./accounts";
import { requestSync, resetSyncEngine } from "./engine";
import { readLanded } from "./landed";
import { pendingOperations } from "./queue";
import { recordSettlement } from "./shared";
import { outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";
import { createTransaction } from "./transactions";

const fetchMock = vi.fn<typeof fetch>();
const T0 = "2026-08-01T10:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";
const T2 = "2026-09-04T12:00:05.000Z";
const cash = account({
  id: "a1",
  name: "Cash",
  balance: 1000,
  openingBalance: 1000,
  updatedAt: T0,
});
const bank = account({ id: "a2", name: "Bank", balance: 500, isDefault: false, updatedAt: T0 });
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
const moved = (id: string, updatedAt = T1): Restamp => ({
  entity: "account",
  id,
  previousUpdatedAt: T0,
  updatedAt,
});

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
  await vault.db.put("accounts", accountRecord(bank));
  await vault.db.put("meta", { key: "syncedAt", value: T0 });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const feedOf = (
  rows: Partial<SyncChangesResponse["changes"]>,
  hasMore = false,
): SyncChangesResponse => ({
  serverTime: T1,
  changes: feedChanges(rows),
  pagination: { limit: 500, count: 1, hasMore, nextCursor: hasMore ? "c1" : "c2" },
});

const balanceOf = async (id: string) =>
  (await readAccounts()).data.find((row) => row.id === id)?.balance;

const pull = (vault: VaultHandle, page: SyncChangesResponse) =>
  pullChanges(vault, { fetchPage: () => Promise.resolve(page) });

const answer = (restamped: Restamp[] = [moved("a1")]) => {
  answerBatch(fetchMock, () => ({ ...applied(served), restamped }));
};

async function queuedExpense() {
  const vault = await vaultWith();
  reportOnline(false);
  await createTransaction(coffee, "t2");
  return vault;
}

async function settledExpense(restamped?: Restamp[]) {
  const vault = await queuedExpense();
  answer(restamped);
  reportOnline(true);
  await requestSync();
  expect(await pendingOperations(vault.db)).toEqual([]);
  expect((await vault.db.get("accounts", "a1"))?.row.balance).toBe(1000);
  return vault;
}

describe("a write the server applied, before a pull brings its balance (T-260)", () => {
  it("keeps the expense counted and marked, though the restamp moved the account's stamp", async () => {
    const vault = await settledExpense();

    expect((await vault.db.get("accounts", "a1"))?.row.updatedAt).toBe(T1);
    expect(await balanceOf("a1")).toBe(950);
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
    expect(await balanceOf("a1")).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
    expect(outboxStatusStore.getSnapshot().projected.balances).toBe(false);
  });

  it("keeps it counted while the pull that would bring the balance fails", async () => {
    const vault = await settledExpense();

    await expect(
      pullChanges(vault, { fetchPage: () => Promise.reject(new Error("offline")) }),
    ).rejects.toThrow("offline");

    expect(await balanceOf("a1")).toBe(950);
  });

  it("keeps it counted when the pull breaks after a page that did not bring the account", async () => {
    const vault = await settledExpense([]);
    let page = 0;

    await expect(
      pullChanges(vault, {
        fetchPage: () => {
          page += 1;
          return page === 1 ? Promise.resolve(feedOf({}, true)) : Promise.reject(new Error("cut"));
        },
      }),
    ).rejects.toThrow("cut");

    expect(await balanceOf("a1")).toBe(950);
  });

  it("lets go when a pull already running brings the account at the answer's stamp", async () => {
    const vault = await queuedExpense();
    answer();
    reportOnline(true);

    await pullChanges(vault, {
      fetchPage: async () => {
        await requestSync();
        return feedOf({ transactions: [served], accounts: [spent] });
      },
    });

    expect(await balanceOf("a1")).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
  });

  it("keeps it when a pull already running finishes without the account", async () => {
    const vault = await queuedExpense();
    answer();
    reportOnline(true);

    await pullChanges(vault, {
      fetchPage: async () => {
        await requestSync();
        return feedOf({});
      },
    });

    expect(await balanceOf("a1")).toBe(950);
  });

  it("lets go of an answer that named no account once a pull that began after it finishes", async () => {
    const vault = await settledExpense([]);

    await pull(vault, feedOf({ accounts: [spent] }));

    expect(await balanceOf("a1")).toBe(950);
    expect(await readLanded(vault.db)).toEqual([]);
  });

  it("counts it once when the same round also answers the account, balance included", async () => {
    const vault = await queuedExpense();
    await updateAccount("a1", { name: "Wallet" });
    answerBatch(fetchMock, (operation) =>
      operation.entity === "account"
        ? applied({ ...spent, name: "Wallet", updatedAt: T2 })
        : { ...applied(served), restamped: [moved("a1")] },
    );
    reportOnline(true);
    await requestSync();

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(await balanceOf("a1")).toBe(950);
  });

  it("lets go of each account of a transfer as its own balance arrives", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const transfer = { ...coffee, type: "TRANSFER" as const, toAccountId: "a2", categoryId: null };
    await createTransaction(transfer, "t2");
    answerBatch(fetchMock, () => ({
      ...applied(transaction({ ...transfer, updatedAt: T1 })),
      restamped: [moved("a1"), moved("a2")],
    }));
    reportOnline(true);

    await pullChanges(vault, {
      fetchPage: async () => {
        await requestSync();
        return feedOf({ accounts: [spent] });
      },
    });

    expect(await balanceOf("a1")).toBe(950);
    expect(await balanceOf("a2")).toBe(550);
  });

  it("counts a payment the server took until its balance arrives", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const payment = await recordSettlement({
      groupId: null,
      counterparty: { contactId: "k1", expenseId: null },
      date: "2026-09-04T11:00:00.000Z",
      collected: 600,
      paid: 0,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 0,
    });
    const recorded = {
      settlement: settlement({ ...payment, updatedAt: T1 }),
      covered: [],
      refunded: 0,
    };
    answerBatch(fetchMock, () => ({
      ...applied(recorded),
      restamped: [moved("a1")],
    }));
    reportOnline(true);
    await requestSync();

    expect(await balanceOf("a1")).toBe(1600);
    await pull(vault, feedOf({ accounts: [{ ...cash, balance: 1600, updatedAt: T1 }] }));
    expect(await balanceOf("a1")).toBe(1600);
  });

  it("goes with the copy when the mirror is purged", async () => {
    const vault = await settledExpense();

    await purgeVault("u1");

    expect(await readLanded(vault.db)).toEqual([]);
  });

  it("keeps nothing for a write the feed had already brought before it settled (T-162)", async () => {
    const vault = await queuedExpense();
    await pull(vault, feedOf({ transactions: [served], accounts: [spent] }));
    answer();
    reportOnline(true);
    await requestSync();

    expect(await readLanded(vault.db)).toEqual([]);
    expect(await balanceOf("a1")).toBe(950);
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
