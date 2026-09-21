import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, applied, operationsOf } from "@/lib/testing/sync";
import {
  openTestVault,
  profile,
  sharedExpense,
  sharedGroup,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SharedSplit } from "@/types/api";

import { setCurrentVault } from "../repository/read";
import { profileRecord, sharedExpenseRecord, sharedGroupRecord } from "../schema";
import { pendingOperations } from "./queue";
import {
  archiveSharedGroup,
  createSharedExpense,
  createSharedGroup,
  recordSettlement,
  saveSharedSplit,
  undoWriteOff,
  writeOffParty,
} from "./shared";

const ANA = "k1";

const fetchMock = vi.fn<typeof fetch>();

const equal = (amount: number): SharedSplit => ({
  mode: "EQUAL",
  guests: null,
  shares: [
    {
      party: "USER",
      contactId: null,
      percent: null,
      fixedAmount: null,
      amount: amount / 2,
      collected: 0,
    },
    {
      party: "CONTACT",
      contactId: ANA,
      percent: null,
      fixedAmount: null,
      amount: amount / 2,
      collected: 0,
    },
  ],
});

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

async function vaultWith() {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

describe("writing a shared group with no network", () => {
  it("projects the group with you in it, and queues the create", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const group = await createSharedGroup({
      name: "Night out",
      color: "TEAL",
      contactIds: [ANA],
      defaultSplit: { mode: "EQUAL", shares: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    // You are always a participant and are never named among the contacts sent.
    expect(group.participants.map((one) => one.contactId)).toEqual([null, ANA]);
    expect((await vault.db.get("sharedGroups", group.id))?.row.name).toBe("Night out");
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({ entity: "sharedGroup", action: "create" });
  });

  it("sends no split when the expense inherits the group's, which is what tells the two apart", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await createSharedExpense({
      row: {
        id: "e1",
        groupId: "g1",
        description: "Food",
        date: "2026-08-10T20:00:00.000Z",
        amount: 100_000,
        paidByContactId: null,
        split: equal(100_000),
        customSplit: false,
      },
      transactionId: "t1",
    });

    const sent = operationsOf(fetchMock.mock.calls[0]?.[1])[0];
    expect(sent).toMatchObject({
      entity: "sharedExpense",
      action: "create",
      payload: { params: { groupId: "g1" } },
    });
    expect(sent?.payload.body).toEqual({ id: "e1", transactionId: "t1" });
  });

  it("sends the split, without the figures it worked out, when the expense carries its own", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await createSharedExpense({
      row: {
        id: "e2",
        groupId: "g1",
        description: "Fuel",
        date: "2026-08-10T20:00:00.000Z",
        amount: 60_000,
        paidByContactId: null,
        split: equal(60_000),
        customSplit: true,
      },
    });

    const body = operationsOf(fetchMock.mock.calls[0]?.[1])[0]?.payload.body as {
      split: { shares: Record<string, unknown>[] };
    };
    expect(body.split.shares[0]).toEqual({
      party: "USER",
      contactId: null,
      percent: null,
      fixedAmount: null,
    });
  });

  it("hands an expense back to the group's default without typing a split", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "sharedGroups",
      sharedGroupRecord(sharedGroup({ id: "g1", name: "Night out" })),
    );
    await vault.db.put(
      "sharedExpenses",
      sharedExpenseRecord(
        sharedExpense({ id: "e1", groupId: "g1", amount: 100_000, customSplit: true }),
      ),
    );
    reportOnline(false);

    const saved = await saveSharedSplit({
      id: "e1",
      groupId: "g1",
      split: null,
      projected: equal(100_000),
    });

    expect(saved.customSplit).toBe(false);
    expect(saved.split.shares.map((one) => one.amount)).toEqual([50_000, 50_000]);
    const [operation] = await pendingOperations(vault.db);
    expect(operation?.payload).toMatchObject({ body: { useGroupSplit: true } });
  });
});

describe("recording a payment with no network", () => {
  it("projects the payment, the movement it writes and the balance it moves", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const payment = await recordSettlement({
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 60_000,
      paid: 0,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 0,
    });

    expect(payment).toMatchObject({ collected: 60_000, paid: 0, outsideApp: false });
    const movements = (await vault.db.getAll("transactions")).map((record) => record.row);
    expect(movements).toEqual([
      expect.objectContaining({
        type: "SETTLEMENT",
        amount: 60_000,
        toAccountId: "a1",
        categoryId: null,
        sharedSettlementId: payment.id,
      }),
    ]);
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({
      entity: "settlement",
      action: "create",
      payload: {
        effect: { after: { type: "SETTLEMENT", amount: 60_000, toAccountId: "a1" } },
        minted: [movements[0]?.id],
      },
    });
  });

  it("writes one expense of yours per line you cover, dated that line", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await recordSettlement({
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 60_000,
      paid: 30_000,
      outsideApp: false,
      accountId: "a1",
      lines: [
        {
          expenseId: "e9",
          date: "2026-08-14T20:00:00.000Z",
          description: "Tickets",
          amount: 30_000,
          categoryId: "c1",
        },
      ],
      refunded: 0,
    });

    const movements = (await vault.db.getAll("transactions")).map((record) => record.row);
    expect(movements.map((row) => [row.type, row.amount, row.date, row.categoryId])).toEqual([
      ["SETTLEMENT", 60_000, "2026-09-20T12:00:00.000Z", null],
      ["EXPENSE", 30_000, "2026-08-14T20:00:00.000Z", "c1"],
    ]);
    // The balance moves by the net, which is what she actually sends.
    const [operation] = await pendingOperations(vault.db);
    expect(operation?.payload).toMatchObject({
      effect: { after: { amount: 30_000, toAccountId: "a1", fromAccountId: null } },
    });
  });

  it("writes no movement and moves no balance when the cash never reached an account", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await recordSettlement({
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 200_000,
      paid: 0,
      outsideApp: true,
      accountId: null,
      lines: [],
      refunded: 0,
    });

    expect(await vault.db.getAll("transactions")).toEqual([]);
    const [operation] = await pendingOperations(vault.db);
    expect(operation?.payload).not.toHaveProperty("effect");
    expect(operation?.payload).not.toHaveProperty("minted");
  });

  it("drops the movements it minted when the server answers with its own", async () => {
    const vault = await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock, () =>
      applied({
        settlement: {
          id: "p1",
          userId: "u1",
          counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
          date: "2026-09-20T12:00:00.000Z",
          collected: 60_000,
          paid: 0,
          outsideApp: false,
          currency: "COP",
          deletedAt: null,
          createdAt: "2026-09-20T12:00:00.000Z",
          updatedAt: "2026-09-20T12:00:00.000Z",
        },
        covered: [],
        refunded: 0,
      }),
    );

    await recordSettlement({
      id: "p1",
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 60_000,
      paid: 0,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 0,
    });

    expect(await vault.db.getAll("transactions")).toEqual([]);
    expect(await pendingOperations(vault.db)).toEqual([]);
  });
});

describe("giving up on what somebody owes", () => {
  it("stores the ceiling that was open when you decided, and takes it back", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
    reportOnline(false);

    await writeOffParty({ groupId: "g1", contactId: ANA, expenseId: null }, 500_000);
    expect((await vault.db.get("sharedGroups", "g1"))?.row.writeOffs).toEqual([
      { kind: "CONTACT", contactId: ANA, expenseId: null, amount: 500_000, at: expect.any(String) },
    ]);

    await undoWriteOff({ groupId: "g1", contactId: ANA, expenseId: null });
    expect((await vault.db.get("sharedGroups", "g1"))?.row.writeOffs).toEqual([]);
  });

  it("archives a group and writes off what is still owed on your behalf", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
    reportOnline(false);

    await archiveSharedGroup({
      id: "g1",
      owing: [{ contactId: ANA, expenseId: null, amount: 500_000 }],
    });

    const row = (await vault.db.get("sharedGroups", "g1"))?.row;
    expect(row?.archivedAt).not.toBeNull();
    expect(row?.writeOffs).toEqual([
      { kind: "CONTACT", contactId: ANA, expenseId: null, amount: 500_000, at: expect.any(String) },
    ]);
  });
});
