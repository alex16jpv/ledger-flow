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
import { pendingOperations, writeTransaction } from "./queue";
import { reconcileRow } from "./reconcile";
import {
  addParticipants,
  archiveSharedGroup,
  createSharedExpense,
  createSharedGroup,
  recordSettlement,
  removeParticipant,
  restoreSharedGroup,
  saveSharedSplit,
  undoWriteOff,
  updateSharedGroup,
  writeOffParty,
} from "./shared";
import { createTransaction } from "./transactions";

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

  // T-137 records both halves in one gesture, so the movement it names can still be queued.
  it("makes the expense wait for the movement it names", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const movement = await createTransaction(
      {
        id: "t7",
        type: "EXPENSE",
        amount: 4500,
        date: "2026-09-21T17:00:00.000Z",
        categoryId: null,
        fromAccountId: "a1",
        toAccountId: null,
        description: "Beach club",
        tags: [],
        note: null,
      },
      "idem-1",
    );
    await createSharedExpense({
      row: {
        id: "e7",
        groupId: "g1",
        description: "Beach club",
        date: "2026-09-21T17:00:00.000Z",
        amount: 4500,
        paidByContactId: null,
        split: equal(4500),
        customSplit: false,
      },
      transactionId: movement.id,
    });

    const queued = await pendingOperations(vault.db);
    expect(queued.find((one) => one.entity === "sharedExpense")?.dependsOn).toContain("t7");
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

describe("what a payment puts on the wire", () => {
  it("sends the two halves, the account and a category per line, with the first as the fallback", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await recordSettlement({
      id: "p1",
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 56_300,
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

    const sent = operationsOf(fetchMock.mock.calls[0]?.[1])[0];
    expect(sent).toMatchObject({ entity: "settlement", action: "create" });
    expect(sent?.payload.body).toEqual({
      id: "p1",
      contactId: ANA,
      date: "2026-09-20T12:00:00.000Z",
      collected: 56_300,
      paid: 30_000,
      accountId: "a1",
      categoryId: "c1",
      categories: [{ expenseId: "e9", categoryId: "c1" }],
    });
  });

  it("names the block of guests instead of a contact, and carries no account in cash", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await recordSettlement({
      id: "p2",
      counterparty: { contactId: null, expenseId: "e4" },
      date: "2026-09-20T12:00:00.000Z",
      collected: 200_000,
      paid: 0,
      outsideApp: true,
      accountId: null,
      lines: [],
      refunded: 0,
    });

    expect(operationsOf(fetchMock.mock.calls[0]?.[1])[0]?.payload.body).toEqual({
      id: "p2",
      expenseId: "e4",
      date: "2026-09-20T12:00:00.000Z",
      collected: 200_000,
      outsideApp: true,
    });
  });

  it("writes the movement that hands a surplus back out of the account", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await recordSettlement({
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 0,
      paid: 20_000,
      outsideApp: false,
      accountId: "a1",
      lines: [],
      refunded: 20_000,
    });

    const movements = (await vault.db.getAll("transactions")).map((record) => record.row);
    expect(
      movements.map((row) => [row.type, row.amount, row.fromAccountId, row.categoryId]),
    ).toEqual([["SETTLEMENT", 20_000, "a1", null]]);
    const [operation] = await pendingOperations(vault.db);
    expect(operation?.payload).toMatchObject({
      effect: { after: { amount: 20_000, fromAccountId: "a1", toAccountId: null } },
    });
  });

  it("writes no expense of yours when you paid them in cash the app never held", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await recordSettlement({
      counterparty: { contactId: ANA, expenseId: null },
      date: "2026-09-20T12:00:00.000Z",
      collected: 0,
      paid: 30_000,
      outsideApp: true,
      accountId: null,
      lines: [],
      refunded: 0,
    });

    expect(await vault.db.getAll("transactions")).toEqual([]);
  });
});

// D-23: a pull landing while the write is still queued must not lose what it projected.
describe("what a pull sees while the group's write is still queued", () => {
  it("keeps the write-off the archive gave up on your behalf", async () => {
    const vault = await vaultWith();
    const stored = sharedGroup({ id: "g1", updatedAt: "2026-09-01T00:00:00.000Z" });
    await vault.db.put("sharedGroups", sharedGroupRecord(stored));
    reportOnline(false);

    await archiveSharedGroup({
      id: "g1",
      owing: [{ contactId: ANA, expenseId: null, amount: 500_000 }],
    });

    const tx = writeTransaction(vault.db);
    await reconcileRow(tx, "sharedGroup", "g1", stored);
    await tx.done;

    const row = (await vault.db.get("sharedGroups", "g1"))?.row;
    expect(row?.archivedAt).not.toBeNull();
    expect(row?.writeOffs).toEqual([
      { kind: "CONTACT", contactId: ANA, expenseId: null, amount: 500_000, at: expect.any(String) },
    ]);
  });
});

describe("editing a group and its people with no network", () => {
  it("saves the name, the colour and the default split", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
    reportOnline(false);

    await updateSharedGroup({
      id: "g1",
      name: "Cartagena trip",
      color: "TEAL",
      defaultSplit: { mode: "PERCENT", shares: [{ contactId: null, percent: 100 }] },
    });

    const row = (await vault.db.get("sharedGroups", "g1"))?.row;
    expect(row).toMatchObject({ name: "Cartagena trip", color: "TEAL" });
    expect(row?.defaultSplit.mode).toBe("PERCENT");
  });

  it("adds people without touching what is already recorded unless it is asked to", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: "g1" })));
    reportOnline(false);

    await addParticipants({ id: "g1", contactIds: [ANA], applyToExistingExpenses: false });

    const [queued] = await pendingOperations(vault.db);
    expect(queued).toMatchObject({ entity: "sharedGroup", action: "addParticipants" });
    expect(queued?.payload).toMatchObject({ body: { contactIds: [ANA] } });

    expect(
      (await vault.db.get("sharedGroups", "g1"))?.row.participants.map((one) => one.contactId),
    ).toEqual([null, ANA]);
  });

  it("takes a write-off out with the person, so coming back does not come back forgiven", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "sharedGroups",
      sharedGroupRecord(
        sharedGroup({
          id: "g1",
          participants: [
            { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
            { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
          ],
          writeOffs: [
            {
              kind: "CONTACT",
              contactId: ANA,
              expenseId: null,
              amount: 10_000,
              at: "2026-09-01T00:00:00.000Z",
            },
          ],
        }),
      ),
    );
    reportOnline(false);

    await removeParticipant({ id: "g1", contactId: ANA });

    const row = (await vault.db.get("sharedGroups", "g1"))?.row;
    expect(row?.participants.map((one) => one.contactId)).toEqual([null]);
    expect(row?.writeOffs).toEqual([]);
  });

  it("brings an archived group back", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "sharedGroups",
      sharedGroupRecord(sharedGroup({ id: "g1", archivedAt: "2026-09-10T00:00:00.000Z" })),
    );
    reportOnline(false);

    await restoreSharedGroup("g1");

    expect((await vault.db.get("sharedGroups", "g1"))?.row.archivedAt).toBeNull();
  });
});

// D-23: every rule is the mirror image of what its write projects, or a pull undoes the work.
describe("what a pull sees while a group's edit is still queued", () => {
  const stored = () =>
    sharedGroup({
      id: "g1",
      updatedAt: "2026-09-01T00:00:00.000Z",
      participants: [
        { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
        { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
      ],
      defaultSplit: {
        mode: "PERCENT",
        shares: [
          { contactId: null, percent: 50 },
          { contactId: ANA, percent: 50 },
        ],
      },
      writeOffs: [
        {
          kind: "CONTACT",
          contactId: ANA,
          expenseId: null,
          amount: 10_000,
          at: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

  async function afterPull(vault: Awaited<ReturnType<typeof vaultWith>>) {
    const tx = writeTransaction(vault.db);
    await reconcileRow(tx, "sharedGroup", "g1", stored());
    await tx.done;
    return (await vault.db.get("sharedGroups", "g1"))?.row;
  }

  it("keeps an edit", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(stored()));
    reportOnline(false);

    await updateSharedGroup({
      id: "g1",
      name: "Cartagena trip",
      color: "TEAL",
      defaultSplit: { mode: "EQUAL", shares: [] },
    });

    expect(await afterPull(vault)).toMatchObject({ name: "Cartagena trip", color: "TEAL" });
  });

  it("keeps somebody just added", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(stored()));
    reportOnline(false);

    await addParticipants({ id: "g1", contactIds: ["k9"], applyToExistingExpenses: false });

    expect((await afterPull(vault))?.participants.map((one) => one.contactId)).toEqual([
      null,
      ANA,
      "k9",
    ]);
  });

  it("keeps somebody taken out, their write-off, and a default split that still adds to 100", async () => {
    const vault = await vaultWith();
    await vault.db.put("sharedGroups", sharedGroupRecord(stored()));
    reportOnline(false);

    await removeParticipant({ id: "g1", contactId: ANA });

    const row = await afterPull(vault);
    expect(row?.participants.map((one) => one.contactId)).toEqual([null]);
    expect(row?.writeOffs).toEqual([]);
    expect(row?.defaultSplit.shares).toEqual([{ contactId: null, percent: 100 }]);
  });

  it("keeps a group brought back", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "sharedGroups",
      sharedGroupRecord({ ...stored(), archivedAt: "2026-09-10T00:00:00.000Z" }),
    );
    reportOnline(false);

    await restoreSharedGroup("g1");

    const tx = writeTransaction(vault.db);
    await reconcileRow(tx, "sharedGroup", "g1", {
      ...stored(),
      archivedAt: "2026-09-10T00:00:00.000Z",
    });
    await tx.done;
    expect((await vault.db.get("sharedGroups", "g1"))?.row.archivedAt).toBeNull();
  });
});
