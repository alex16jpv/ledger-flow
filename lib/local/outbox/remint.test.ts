import {
  account,
  contact,
  joinedExpense,
  openTestVault,
  settlement,
  sharedExpense,
  sharedGroup,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SharedSplit } from "@/types/api";

import {
  accountRecord,
  contactRecord,
  joinedExpenseRecord,
  type OutboxOperation,
  settlementRecord,
  sharedExpenseRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { operationPayload } from "./envelope";
import type { VaultDb } from "./queue";
import { remint } from "./remint";

const OLD = "01900000-0000-7000-8000-000000000001";
const NEW = "01900000-0000-7000-8000-000000000002";

afterEach(async () => {
  await wipeVaults();
});

const withAna = (contactId: string | null): SharedSplit => ({
  mode: "EQUAL",
  guests: null,
  shares: [
    { party: "USER", contactId: null, percent: null, fixedAmount: null, amount: 50, collected: 0 },
    { party: "CONTACT", contactId, percent: null, fixedAmount: null, amount: 50, collected: 0 },
  ],
});

let seq = 0;

const queued = (
  operation: Pick<OutboxOperation, "entity" | "entityId" | "action"> & Partial<OutboxOperation>,
): OutboxOperation => {
  seq += 1;
  return {
    seq,
    opId: `op-${seq}`,
    opVersion: 1,
    occurredAt: "2026-09-23T10:00:00.000Z",
    payload: {},
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    ...operation,
  };
};

async function vault(): Promise<VaultDb> {
  return (await openTestVault("u1")).db;
}

async function queue(db: VaultDb, ...operations: OutboxOperation[]): Promise<void> {
  for (const operation of operations) await db.put("outbox", operation);
}

const outbox = async (db: VaultDb) =>
  (await db.getAll("outbox")).sort((left, right) => left.seq - right.seq);

describe("re-minting a contact", () => {
  it("moves the contact and every group, expense and payment that names it", async () => {
    const db = await vault();
    const ana = contact({ id: OLD });
    await db.put("contacts", contactRecord(ana, ana));
    const group = sharedGroup({
      participants: [
        { contactId: null, addedAt: "2026-09-01T00:00:00.000Z" },
        { contactId: OLD, addedAt: "2026-09-01T00:00:00.000Z" },
      ],
      defaultSplit: {
        mode: "PERCENT",
        shares: [
          { contactId: null, percent: 50 },
          { contactId: OLD, percent: 50 },
        ],
      },
      writeOffs: [
        {
          kind: "CONTACT",
          contactId: OLD,
          expenseId: null,
          amount: 50,
          at: "2026-09-02T00:00:00.000Z",
        },
      ],
    });
    await db.put("sharedGroups", sharedGroupRecord(group, group));
    const expense = sharedExpense({ paidByContactId: OLD, split: withAna(OLD) });
    await db.put("sharedExpenses", sharedExpenseRecord(expense, expense));
    const payment = settlement({
      counterparty: { kind: "CONTACT", contactId: OLD, expenseId: null },
    });
    await db.put("settlements", settlementRecord(payment, payment));

    await remint(db, "contact", OLD, NEW);

    expect(await db.get("contacts", OLD)).toBeUndefined();
    const moved = await db.get("contacts", NEW);
    expect(moved?.row).toMatchObject({ id: NEW, name: "Ana" });
    expect(moved?.server?.id).toBe(NEW);
    const groupAfter = await db.get("sharedGroups", "g1");
    for (const row of [groupAfter?.row, groupAfter?.server]) {
      expect(row?.participants.map((one) => one.contactId)).toEqual([null, NEW]);
      expect(row?.defaultSplit.shares.map((one) => one.contactId)).toEqual([null, NEW]);
      expect(row?.writeOffs[0]?.contactId).toBe(NEW);
    }
    const expenseAfter = await db.get("sharedExpenses", "s1");
    for (const row of [expenseAfter?.row, expenseAfter?.server]) {
      expect(row?.paidByContactId).toBe(NEW);
      expect(row?.split.shares.map((one) => one.contactId)).toEqual([null, NEW]);
    }
    const paymentAfter = await db.get("settlements", "p1");
    expect(paymentAfter?.row.counterparty.contactId).toBe(NEW);
    expect(paymentAfter?.server?.counterparty.contactId).toBe(NEW);
  });

  it("moves it in every queued body, path and plan that names it, and sends its create again", async () => {
    const db = await vault();
    await db.put("contacts", contactRecord(contact({ id: OLD })));
    await queue(
      db,
      queued({
        entity: "contact",
        entityId: OLD,
        action: "create",
        payload: { body: { id: OLD, name: "Ana" } },
        status: "conflict",
        lastError: "ID_TAKEN",
      }),
      queued({
        entity: "sharedGroup",
        entityId: "g1",
        action: "create",
        payload: {
          body: {
            id: "g1",
            name: "Cartagena",
            contactIds: [OLD],
            defaultSplit: { mode: "PERCENT", shares: [{ contactId: OLD, percent: 50 }] },
          },
        },
        dependsOn: [OLD],
      }),
      queued({
        entity: "sharedExpense",
        entityId: "s1",
        action: "create",
        payload: {
          body: { id: "s1", paidByContactId: OLD, split: withAna(OLD) },
          params: { groupId: "g1" },
        },
      }),
      queued({
        entity: "settlement",
        entityId: "p1",
        action: "create",
        payload: { body: { id: "p1", contactId: OLD, date: "2026-09-02T00:00:00.000Z" } },
        dependsOn: [OLD],
      }),
      queued({
        entity: "sharedGroup",
        entityId: "g1",
        action: "removeParticipant",
        payload: { params: { partyId: OLD } },
      }),
      queued({
        entity: "sharedGroup",
        entityId: "g1",
        action: "archive",
        payload: { archivedOwing: [{ contactId: OLD, expenseId: null, amount: 50 }] },
      }),
    );

    await remint(db, "contact", OLD, NEW);

    const [create, group, expense, payment, removal, archive] = await outbox(db);
    expect(create).toMatchObject({
      entityId: NEW,
      status: "pending",
      lastError: null,
      reminted: true,
      payload: { body: { id: NEW } },
    });
    expect(group?.payload).toMatchObject({
      body: { contactIds: [NEW], defaultSplit: { shares: [{ contactId: NEW }] } },
    });
    expect(group?.dependsOn).toEqual([NEW]);
    expect(group?.reminted).toBeUndefined();
    expect(expense?.payload).toMatchObject({
      body: { paidByContactId: NEW, split: withAna(NEW) },
      params: { groupId: "g1" },
    });
    expect(payment?.payload).toMatchObject({ body: { contactId: NEW } });
    expect(payment?.dependsOn).toEqual([NEW]);
    expect(removal?.payload).toMatchObject({ params: { partyId: NEW } });
    expect(operationPayload(archive!).archivedOwing).toEqual([
      { contactId: NEW, expenseId: null, amount: 50 },
    ]);
  });

  it("keeps the server's row when the create merged into a contact the mirror already holds", async () => {
    const db = await vault();
    await db.put("contacts", contactRecord(contact({ id: OLD, name: "Ana" })));
    await db.put("contacts", contactRecord(contact({ id: NEW, name: "Ana", color: "RED" })));
    const expense = sharedExpense({ paidByContactId: OLD });
    await db.put("sharedExpenses", sharedExpenseRecord(expense));

    await remint(db, "contact", OLD, NEW);

    expect(await db.get("contacts", OLD)).toBeUndefined();
    expect((await db.get("contacts", NEW))?.row.color).toBe("RED");
    expect((await db.get("sharedExpenses", "s1"))?.row.paidByContactId).toBe(NEW);
  });
});

describe("re-minting a shared group", () => {
  it("moves the group, its expenses, its movements and the queued writes under it", async () => {
    const db = await vault();
    const group = sharedGroup({ id: OLD });
    await db.put("sharedGroups", sharedGroupRecord(group, group));
    await db.put("sharedExpenses", sharedExpenseRecord(sharedExpense({ groupId: OLD })));
    await db.put(
      "transactions",
      transactionRecord(transaction({ id: "t1", sharedExpenseId: "s1", sharedGroupId: OLD })),
    );
    await queue(
      db,
      queued({
        entity: "sharedGroup",
        entityId: OLD,
        action: "create",
        payload: { body: { id: OLD, name: "Cartagena" } },
      }),
      queued({
        entity: "sharedExpense",
        entityId: "s1",
        action: "create",
        payload: { body: { id: "s1", transactionId: "t1" }, params: { groupId: OLD } },
        dependsOn: [OLD],
      }),
    );

    await remint(db, "sharedGroup", OLD, NEW);

    expect(await db.get("sharedGroups", OLD)).toBeUndefined();
    expect((await db.get("sharedGroups", NEW))?.server?.id).toBe(NEW);
    expect((await db.get("sharedExpenses", "s1"))?.row.groupId).toBe(NEW);
    expect((await db.get("transactions", "t1"))?.row.sharedGroupId).toBe(NEW);
    const [create, expense] = await outbox(db);
    expect(create).toMatchObject({ entityId: NEW, reminted: true, payload: { body: { id: NEW } } });
    expect(expense?.payload).toMatchObject({
      body: { transactionId: "t1" },
      params: { groupId: NEW },
    });
    expect(expense?.dependsOn).toEqual([NEW]);
  });

  it("leaves alone the rows of a group somebody else shared, whose id is the one that was taken", async () => {
    const db = await vault();
    await db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: OLD })));
    const added = transaction({ id: "t9", importedFromGroupId: OLD, importedFromExpenseId: "x1" });
    await db.put("transactions", transactionRecord(added));
    await db.put("joinedExpenses", joinedExpenseRecord(joinedExpense({ id: "x1", groupId: OLD })));

    await remint(db, "sharedGroup", OLD, NEW);

    expect((await db.get("transactions", "t9"))?.row.importedFromGroupId).toBe(OLD);
    expect((await db.get("joinedExpenses", "x1"))?.row.groupId).toBe(OLD);
  });
});

describe("re-minting a shared expense", () => {
  it("moves the expense and the movement, write-off and payment that name it", async () => {
    const db = await vault();
    await db.put("sharedExpenses", sharedExpenseRecord(sharedExpense({ id: OLD })));
    const movement = transaction({ id: "t1", sharedExpenseId: OLD, sharedGroupId: "g1" });
    await db.put("transactions", transactionRecord(movement, movement));
    await db.put(
      "sharedGroups",
      sharedGroupRecord(
        sharedGroup({
          writeOffs: [
            {
              kind: "GUESTS",
              contactId: null,
              expenseId: OLD,
              amount: 20,
              at: "2026-09-02T00:00:00.000Z",
            },
          ],
        }),
      ),
    );
    await db.put(
      "settlements",
      settlementRecord(
        settlement({ counterparty: { kind: "GUESTS", contactId: null, expenseId: OLD } }),
      ),
    );
    await queue(
      db,
      queued({
        entity: "sharedExpense",
        entityId: OLD,
        action: "create",
        payload: { body: { id: OLD, transactionId: "t1" }, params: { groupId: "g1" } },
      }),
      queued({
        entity: "transaction",
        entityId: "t1",
        action: "update",
        payload: { body: { amount: 120 }, sharedExpenseId: OLD },
      }),
      queued({
        entity: "sharedGroup",
        entityId: "g1",
        action: "writeOff",
        payload: { body: { expenseId: OLD }, params: { partyId: OLD }, writtenOff: 20 },
        dependsOn: [OLD],
      }),
      queued({
        entity: "settlement",
        entityId: "p2",
        action: "create",
        payload: {
          body: {
            id: "p2",
            expenseId: OLD,
            date: "2026-09-02T00:00:00.000Z",
            categoryId: "c1",
            categories: [{ expenseId: OLD, categoryId: "c1" }],
          },
        },
        dependsOn: [OLD],
      }),
    );

    await remint(db, "sharedExpense", OLD, NEW);

    expect(await db.get("sharedExpenses", OLD)).toBeUndefined();
    expect((await db.get("sharedExpenses", NEW))?.row.id).toBe(NEW);
    const movementAfter = await db.get("transactions", "t1");
    expect(movementAfter?.row.sharedExpenseId).toBe(NEW);
    expect(movementAfter?.server?.sharedExpenseId).toBe(NEW);
    expect((await db.get("sharedGroups", "g1"))?.row.writeOffs[0]?.expenseId).toBe(NEW);
    expect((await db.get("settlements", "p1"))?.row.counterparty.expenseId).toBe(NEW);
    const [create, update, writeOff, payment] = await outbox(db);
    expect(create).toMatchObject({ entityId: NEW, reminted: true });
    expect(operationPayload(update!).sharedExpenseId).toBe(NEW);
    expect(writeOff?.payload).toMatchObject({
      body: { expenseId: NEW },
      params: { partyId: NEW },
    });
    expect(writeOff?.dependsOn).toEqual([NEW]);
    expect(payment?.payload).toMatchObject({
      body: { expenseId: NEW, categories: [{ expenseId: NEW, categoryId: "c1" }] },
    });
  });
});

describe("re-minting a payment", () => {
  it("moves the payment and the movements it wrote", async () => {
    const db = await vault();
    await db.put("settlements", settlementRecord(settlement({ id: OLD })));
    await db.put(
      "transactions",
      transactionRecord(transaction({ id: "m1", type: "SETTLEMENT", sharedSettlementId: OLD })),
    );
    await queue(
      db,
      queued({
        entity: "settlement",
        entityId: OLD,
        action: "create",
        payload: { body: { id: OLD, contactId: "k1" }, minted: ["m1"] },
      }),
    );

    await remint(db, "settlement", OLD, NEW);

    expect(await db.get("settlements", OLD)).toBeUndefined();
    expect((await db.get("settlements", NEW))?.row.id).toBe(NEW);
    expect((await db.get("transactions", "m1"))?.row.sharedSettlementId).toBe(NEW);
    const [create] = await outbox(db);
    expect(create).toMatchObject({ entityId: NEW, reminted: true, payload: { body: { id: NEW } } });
  });
});

describe("re-minting what a queued payment names besides Shared", () => {
  it("moves the account it lands on and the categories of the lines it covers", async () => {
    const db = await vault();
    await queue(
      db,
      queued({
        entity: "settlement",
        entityId: "p1",
        action: "create",
        payload: {
          body: {
            id: "p1",
            contactId: "k1",
            date: "2026-09-02T00:00:00.000Z",
            accountId: OLD,
            categoryId: "c-old",
            categories: [{ expenseId: "s1", categoryId: "c-old" }],
          },
        },
        dependsOn: [OLD],
      }),
    );

    await remint(db, "account", OLD, NEW);
    await remint(db, "category", "c-old", "c-new");

    const [payment] = await outbox(db);
    expect(payment?.payload).toMatchObject({
      body: {
        accountId: NEW,
        categoryId: "c-new",
        categories: [{ expenseId: "s1", categoryId: "c-new" }],
      },
    });
    expect(payment?.dependsOn).toEqual([NEW]);
  });
});

describe("what a re-mint must keep true besides the rows", () => {
  it("files a moved movement under the new account in the indexes the screens read", async () => {
    const db = await vault();
    await db.put("accounts", accountRecord(account({ id: OLD })));
    await db.put("transactions", transactionRecord(transaction({ id: "t1", fromAccountId: OLD })));

    await remint(db, "account", OLD, NEW);

    expect(
      (await db.getAllFromIndex("transactions", "fromAccountId", NEW)).map((one) => one.id),
    ).toEqual(["t1"]);
    expect(await db.getAllFromIndex("transactions", "fromAccountId", OLD)).toEqual([]);
  });

  it("moves the account inside a queued movement's effect, which the balances read", async () => {
    const db = await vault();
    const effect = {
      before: null,
      after: {
        type: "EXPENSE",
        amount: 12,
        fromAccountId: OLD,
        toAccountId: null,
        deletedAt: null,
      },
    };
    await queue(
      db,
      queued({
        entity: "transaction",
        entityId: "t1",
        action: "create",
        payload: { body: { id: "t1", fromAccountId: OLD }, effect },
        dependsOn: [OLD],
      }),
    );

    await remint(db, "account", OLD, NEW);

    const [movement] = await outbox(db);
    expect(operationPayload(movement!).effect?.after).toMatchObject({ fromAccountId: NEW });
    expect(movement?.payload).toMatchObject({ body: { fromAccountId: NEW } });
  });

  it("leaves a queued write alone when it names neither the old id nor somebody else's", async () => {
    const db = await vault();
    const untouched = queued({
      entity: "transaction",
      entityId: "t9",
      action: "update",
      payload: { body: { importedFromExpenseId: OLD, description: "Cena" } },
      baseUpdatedAt: "2026-09-01T00:00:00.000Z",
    });
    await queue(db, untouched);

    await remint(db, "sharedExpense", OLD, NEW);

    expect(await outbox(db)).toEqual([untouched]);
  });

  it("points the queued writes at the server's group when the create merged into it", async () => {
    const db = await vault();
    await db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: OLD, name: "Cartagena" })));
    await db.put("sharedGroups", sharedGroupRecord(sharedGroup({ id: NEW, color: "RED" })));
    await queue(
      db,
      queued({
        entity: "sharedExpense",
        entityId: "s1",
        action: "create",
        payload: { body: { id: "s1" }, params: { groupId: OLD } },
        dependsOn: [OLD],
      }),
    );

    await remint(db, "sharedGroup", OLD, NEW);

    expect(await db.get("sharedGroups", OLD)).toBeUndefined();
    expect((await db.get("sharedGroups", NEW))?.row.color).toBe("RED");
    const [expense] = await outbox(db);
    expect(expense?.payload).toMatchObject({ params: { groupId: NEW } });
    expect(expense?.dependsOn).toEqual([NEW]);
  });
});
