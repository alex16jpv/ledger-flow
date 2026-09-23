import { ApiError } from "@/lib/api/errors";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, conflictWith, operationsOf, rejectedWith } from "@/lib/testing/sync";
import {
  account,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { Account } from "@/types/api";

import { setCurrentVault } from "../repository/read";
import { accountRecord, profileRecord, transactionRecord } from "../schema";
import { createAccount, updateAccount } from "./accounts";
import { createCategory } from "./categories";
import { requestSync } from "./engine";
import { operationPayload } from "./envelope";
import { pendingOperations } from "./queue";
import { resetOutboxStatus, setBlockedOperations } from "./status";
import {
  createTransaction,
  deleteTransaction,
  quickAddTransaction,
  updateTransaction,
} from "./transactions";
import { writeAll } from "./write";

const fetchMock = vi.fn<typeof fetch>();
const cash = account({ id: "a1", name: "Cash", balance: 1000, openingBalance: 1000 });

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

async function vaultWith(rows: { accounts?: Account[] } = {}) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  for (const row of rows.accounts ?? [cash]) await vault.db.put("accounts", accountRecord(row));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

const headerOf = (call: number, name: string) =>
  new Headers(fetchMock.mock.calls[call]?.[1]?.headers).get(name);

const guardOf = (call: number) => operationsOf(fetchMock.mock.calls[call]?.[1])[0]?.baseUpdatedAt;

describe("writing through the outbox", () => {
  it("answers from the projection with no network, and leaves the operation queued", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 250 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(created).toMatchObject({
      name: "Wallet",
      balance: 250,
      openingBalance: 250,
      currency: "COP",
      userId: profile().id,
    });
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({ entity: "account", action: "create", status: "pending" });
    expect(await vault.db.get("accounts", created.id)).toBeDefined();
  });

  it("carries a debt amount into the mirror with no network (T-88)", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const created = await createAccount({
      name: "Visa Gold",
      type: "CARD",
      balance: -1245900,
      creditLimit: 4000000,
    });

    expect(created.creditLimit).toBe(4000000);
    expect((await vault.db.get("accounts", created.id))?.row.creditLimit).toBe(4000000);
  });

  it("leaves the field off an account that never sent one (T-88)", async () => {
    await vaultWith();
    reportOnline(false);

    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 250 });

    expect(created).not.toHaveProperty("creditLimit");
  });

  it("clears a debt amount the way the server answers it: absent, not null (T-88)", async () => {
    const card = account({
      id: "a2",
      name: "Visa Gold",
      balance: -1245900,
      openingBalance: -1245900,
    });
    const vault = await vaultWith({ accounts: [{ ...card, type: "CARD", creditLimit: 4000000 }] });
    reportOnline(false);

    const raised = await updateAccount("a2", { creditLimit: 5000000 });
    expect(raised.creditLimit).toBe(5000000);

    const cleared = await updateAccount("a2", { creditLimit: null });
    expect(cleared).not.toHaveProperty("creditLimit");
    expect((await vault.db.get("accounts", "a2"))?.row).not.toHaveProperty("creditLimit");
  });

  // F-65: blocking the record would be worse, and nothing new waits behind what is blocked.
  it("keeps writing normally while an app update holds part of the queue back", async () => {
    const vault = await vaultWith();
    await vault.db.put("outbox", {
      seq: 0.5,
      opId: "op-old",
      opVersion: 1,
      entity: "transaction",
      entityId: "t-old",
      action: "create",
      occurredAt: "2026-09-01T10:00:00.000Z",
      payload: {},
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    setBlockedOperations([0.5]);
    reportOnline(false);

    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 250 });

    expect(created.name).toBe("Wallet");
    const queued = await pendingOperations(vault.db);
    expect(queued.map((operation) => operation.entity)).toEqual(["transaction", "account"]);
    // The new one carries no dependency on the blocked one: it is not waiting for it.
    expect(queued[1]?.dependsOn).toEqual([]);
    resetOutboxStatus();
  });

  it("with network the operation leaves the queue and the server's row replaces the projection", async () => {
    const vault = await vaultWith();
    const saved = account({ id: "server-id", name: "Wallet", balance: 250 });
    answerBatch(fetchMock, () => ({ result: saved }));

    const created = await createAccount({
      id: "server-id",
      name: "Wallet",
      type: "CASH",
      balance: 250,
    });

    expect(created).toEqual(saved);
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("accounts", "server-id"))?.row).toEqual(saved);
    // A create carrying an id is already idempotent, so the header is not sent (O-B1).
    expect(headerOf(0, "Idempotency-Key")).toBeNull();
  });

  it("guards an edit with the updatedAt the mirror knew, and undoes it when the server refuses", async () => {
    const vault = await vaultWith();
    answerBatch(fetchMock, () => rejectedWith("VALIDATION"));

    await expect(updateAccount("a1", { name: "Renamed" })).rejects.toThrow();

    expect(guardOf(0)).toBe(cash.updatedAt);
    expect((await vault.db.get("accounts", "a1"))?.row).toEqual(cash);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });

  it("keeps the operation and the projection when the request never arrives", async () => {
    const vault = await vaultWith();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const updated = await updateAccount("a1", { name: "Renamed" });

    expect(updated.name).toBe("Renamed");
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({ status: "pending", attempts: 1, lastError: "NETWORK" });
  });

  it("marks a stale edit as a conflict, shows the server's row and keeps the edit in the envelope", async () => {
    const vault = await vaultWith();
    answerBatch(fetchMock, () => conflictWith("STALE_UPDATE"));

    const updated = await updateAccount("a1", { name: "Renamed" });

    // D-23: a row in conflict shows the server's version; the user's lives in the sheet.
    expect(updated.name).toBe("Cash");
    expect((await vault.db.get("accounts", "a1"))?.row.name).toBe("Cash");
    expect((await pendingOperations(vault.db))[0]).toMatchObject({
      status: "conflict",
      lastError: "STALE_UPDATE",
      payload: { body: { name: "Renamed" } },
    });
  });

  it("takes a movement another device already deleted as the state it asked for", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1" })));
    // Another device deleted it first, so `duplicate` is the state the operation asked for.
    answerBatch(fetchMock, () => ({ status: "duplicate" }));

    await deleteTransaction("t1");

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("transactions", "t1"))?.row.deletedAt).not.toBeNull();
  });

  it("declares the account a movement was created against while it is still unsent", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const created = await createAccount({ name: "Wallet", type: "CASH", balance: 0 });
    await createTransaction(
      {
        type: "EXPENSE",
        amount: 12.5,
        date: "2026-09-04T10:00:00.000Z",
        fromAccountId: created.id,
      },
      "11111111-1111-7111-8111-111111111111",
    );

    const [, movement] = await pendingOperations(vault.db);
    expect(movement?.dependsOn).toEqual([created.id]);
    // The server never printed an updatedAt for a row it has not seen, so nothing guards it.
    expect(movement?.baseUpdatedAt).toBeUndefined();
  });

  it("records what the figure moved, so the projection knows what it replaces", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", amount: 20 })));
    reportOnline(false);

    await updateTransaction("t1", { amount: 35 });

    const { effect } = operationPayload((await pendingOperations(vault.db))[0]!);
    expect(effect?.before).toMatchObject({ amount: 20 });
    expect(effect?.after).toMatchObject({ amount: 35 });
  });
  it("hands a taken name to the form, not to a tray the user never opened", async () => {
    const vault = await vaultWith();
    answerBatch(fetchMock, () => conflictWith("DUPLICATE", cash));

    await expect(createAccount({ name: "Cash", type: "CASH", balance: 0 })).rejects.toMatchObject({
      code: "DUPLICATE",
    });

    // The write is undone, exactly as the route's own 409 undid it: the form is where it is fixed.
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(await vault.db.getAll("accounts")).toHaveLength(1);
  });

  it("tells the form the category it typed already exists, and keeps the server's row", async () => {
    const vault = await vaultWith();
    const server = { ...category({ id: "c-server", name: "Comida" }) };
    answerBatch(fetchMock, () => ({ status: "merged", mergedInto: "c-server", result: server }));

    await expect(
      createCategory({ name: "comida", type: "EXPENSE", color: "GREEN" }),
    ).rejects.toMatchObject({ code: "DUPLICATE" });

    // F-57: the minted row is the server's row now, and the operation did land.
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.getAll("categories")).map((record) => record.id)).toEqual(["c-server"]);
  });

  it("leaves a refusal nobody is waiting for in the tray instead of undoing it (F-23)", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1", amount: 20 })));
    reportOnline(false);

    // Queued with no network: the form was answered from the projection and walked away.
    await updateTransaction("t1", { amount: 35 });

    answerBatch(fetchMock, () => rejectedWith("FUTURE_DATE"));
    reportOnline(true);
    await requestSync();

    // Nobody was there to be told why it went, so it stays for the tray with its envelope.
    const [left] = await pendingOperations(vault.db);
    expect(left).toMatchObject({
      status: "failed",
      lastError: "FUTURE_DATE",
      payload: { body: { amount: 35 } },
    });
    // D-23: the row shows the server's version while the operation is stuck.
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(20);
  });
});

// Trap 7.3: §4.1 puts the row and its operation in ONE transaction, so a refusal leaves neither.
describe("when IndexedDB refuses the write", () => {
  it("fails loudly and leaves nothing half-written", async () => {
    const vault = await vaultWith();
    reportOnline(false);
    const quota = new DOMException("no space left", "QuotaExceededError");
    const open = vault.db.transaction.bind(vault.db);
    let refuse = true;
    vault.db.transaction = ((...args: Parameters<typeof open>) => {
      if (refuse) {
        refuse = false;
        throw quota;
      }
      return open(...args);
    }) as typeof open;

    await expect(
      createTransaction(
        { type: "EXPENSE", amount: 5, date: "2026-09-06T10:00:00.000Z", fromAccountId: "a1" },
        "22222222-2222-7222-8222-222222222222",
      ),
    ).rejects.toBe(quota);

    expect(await pendingOperations(vault.db)).toEqual([]);
    expect(await vault.db.getAll("transactions")).toEqual([]);
    // The account keeps the figure the server gave it: nothing was projected onto it.
    expect((await vault.db.get("accounts", "a1"))?.row.balance).toBe(1000);
  });

  // T-73: the sheet sends all three types now, and the mirror has to show the row the server will.
  it("projects a quick income and a quick transfer with no network", async () => {
    const savings = account({ id: "a2", name: "Savings", balance: 500, openingBalance: 500 });
    const vault = await vaultWith({ accounts: [cash, savings] });
    reportOnline(false);

    const income = await quickAddTransaction(
      { amount: 700, type: "INCOME", toAccountId: "a2" },
      "k-income",
    );
    const moved = await quickAddTransaction(
      { amount: 300, type: "TRANSFER", fromAccountId: "a1", toAccountId: "a2" },
      "k-transfer",
    );

    expect(income).toMatchObject({ type: "INCOME", fromAccountId: null, toAccountId: "a2" });
    expect(moved).toMatchObject({ type: "TRANSFER", fromAccountId: "a1", toAccountId: "a2" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await vault.db.get("accounts", "a2"))?.row.balance).toBe(500);
    const queued = await pendingOperations(vault.db);
    expect(queued.map((operation) => operation.action)).toEqual(["quickAdd", "quickAdd"]);
  });

  // The server takes the default account for the side the sheet left empty; so must the mirror.
  it("puts a quick income into the main account when the sheet named none", async () => {
    await vaultWith();
    reportOnline(false);

    const income = await quickAddTransaction({ amount: 700, type: "INCOME" }, "k-default");

    expect(income).toMatchObject({ type: "INCOME", toAccountId: "a1", fromAccountId: null });
  });
});

// T-141: the mirror refuses some writes the way the server would, and in a lot that is one row's fate.
describe("a lot where the device refuses one row", () => {
  it("fails that row with the server's code and still queues the others", async () => {
    const vault = await vaultWith();
    await vault.db.put("transactions", transactionRecord(transaction({ id: "t1" })));
    reportOnline(false);
    const refusal = new ApiError({
      status: 400,
      code: "SPLIT_INVALID",
      message: "no",
      requestId: "mirror",
    });

    const [refused, queued] = await writeAll<string>([
      {
        local: {
          entity: "transaction",
          entityId: "t1",
          action: "update",
          payload: { body: { amount: 1 } },
          project: () => Promise.reject(refusal),
        },
        optimistic: () => "never",
      },
      {
        local: {
          entity: "transaction",
          entityId: "t1",
          action: "update",
          payload: { body: { description: "Taxi" } },
          project: () => Promise.resolve({ dependsOn: [], undo: () => Promise.resolve() }),
        },
        optimistic: () => "queued",
      },
    ]);

    expect(refused).toEqual({ status: "rejected", reason: refusal });
    expect(queued).toEqual({ status: "fulfilled", value: "queued" });
    expect(await pendingOperations(vault.db)).toHaveLength(1);
  });
});
