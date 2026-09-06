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
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";

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

    // D-23: a row whose write is in conflict shows the server's version; the user's lives in the
    // sheet, read off the envelope. The screen gets the same row it will read back.
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
    // Another device deleted it first: the batch answers `duplicate`, which is the state the
    // operation asked for.
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

    // Nothing dangles: the row the device minted is the server's row now (F-57), and the queue is
    // empty — the operation did land, on a row that already existed.
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

    // It stays for the tray with what the user typed still in its envelope, instead of being
    // undone and dropped: nobody was there to be told why it went.
    const [left] = await pendingOperations(vault.db);
    expect(left).toMatchObject({
      status: "failed",
      lastError: "FUTURE_DATE",
      payload: { body: { amount: 35 } },
    });
    // The row shows the server's version while the operation is stuck (D-23); the sheet is where
    // this device's version lives from here on.
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(20);
  });
});
