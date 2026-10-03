import type { SharedLedgerRows } from "@/lib/local/repository";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { sectionOf } from "./ledger";
import {
  capIsTheGroup,
  hasSomethingToSettle,
  isInbound,
  planCrossing,
  planSettlement,
  settleableAmount,
  settleCap,
  settleParty,
  settlePerson,
  writeOffWithoutCrossing,
} from "./settle";

const ANA = "k1";
const BETO = "k2";

const share = (over: Partial<SharedShare> & { amount: number }): SharedShare => ({
  party: "CONTACT",
  contactId: null,
  percent: null,
  fixedAmount: null,
  collected: 0,
  ...over,
});

const withTotals = (row: SyncSharedGroup): SharedGroup => ({
  ...row,
  status: "OPEN",
  totals: {
    amount: 0,
    yourShare: 0,
    owedToYou: 0,
    writtenOff: 0,
    youOwe: 0,
    collected: 0,
    expenseCount: 0,
    dateFrom: null,
    dateTo: null,
  },
});

const equalSplit = (amount: number, people: (string | null)[]) => ({
  mode: "EQUAL" as const,
  guests: null,
  shares: people.map((contactId) =>
    share({
      party: contactId === null ? "USER" : "CONTACT",
      contactId,
      amount: amount / people.length,
    }),
  ),
});

const contacts = [contact({ id: ANA, name: "Ana Ruiz" }), contact({ id: BETO, name: "Beto Cano" })];

// The owner's own example: you front the food and the fuel, Ana fronts the tickets.
function nightOut(): SharedLedgerRows {
  const three = [null, ANA, BETO];
  return {
    groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
    expenses: [
      sharedExpense({
        id: "s1",
        description: "Food",
        date: "2026-08-10T20:00:00.000Z",
        amount: 120_000,
        split: equalSplit(120_000, three),
      }),
      sharedExpense({
        id: "s2",
        description: "Fuel",
        date: "2026-08-12T20:00:00.000Z",
        amount: 60_000,
        split: equalSplit(60_000, three),
      }),
      sharedExpense({
        id: "s3",
        description: "Tickets",
        date: "2026-08-14T20:00:00.000Z",
        amount: 90_000,
        paidByContactId: ANA,
        split: equalSplit(90_000, three),
      }),
    ],
    settlements: [],
    undone: [],
    dropped: [],
    unstored: new Set(),
  };
}

const partyFor = (rows: SharedLedgerRows, contactId: string) => {
  const party = settlePerson(sectionOf(rows, contacts), contactId);
  if (!party) throw new Error(`no party for ${contactId}`);
  return party;
};

describe("what one settle-up covers", () => {
  it("nets both directions and asks only for what changes hands", () => {
    const ana = partyFor(nightOut(), ANA);

    expect(ana).toMatchObject({ owedToYou: 60_000, youOwe: 30_000, net: 30_000 });
    expect(settleableAmount(ana)).toBe(30_000);
    expect(ana.theyOwe.map((line) => line.description)).toEqual(["Food", "Fuel"]);
    expect(ana.yourLines.map((line) => line.description)).toEqual(["Tickets"]);
  });

  it("writes both halves when the net squares it, and the balance moves by the net", () => {
    const plan = planSettlement(partyFor(nightOut(), ANA), 30_000);

    expect(plan).toMatchObject({ collected: 60_000, paid: 30_000, cash: 30_000, refunded: 0 });
    expect(plan.covers.map((line) => [line.description, line.covered])).toEqual([
      ["Food", 40_000],
      ["Fuel", 20_000],
    ]);
    // One expense of yours per line you cover, dated that line: the month the money was spent.
    expect(plan.yourLines.map((line) => [line.description, line.date, line.covered])).toEqual([
      ["Tickets", "2026-08-14T20:00:00.000Z", 30_000],
    ]);
  });

  it("covers what they owe you first when they send less than the net", () => {
    const plan = planSettlement(partyFor(nightOut(), ANA), 25_000);

    expect(plan).toMatchObject({ collected: 25_000, paid: 0 });
    expect(plan.covers.map((line) => [line.description, line.covered])).toEqual([["Food", 25_000]]);
    expect(plan.yourLines).toEqual([]);
  });

  it("imputes a partial payment oldest expense first", () => {
    const plan = planSettlement(partyFor(nightOut(), BETO), 50_000);

    expect(plan.covers.map((line) => [line.description, line.covered])).toEqual([
      ["Food", 40_000],
      ["Fuel", 10_000],
    ]);
  });

  it("leaves nothing to settle once every line is covered", () => {
    const rows = nightOut();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 60_000,
      }),
    ];

    expect(hasSomethingToSettle(partyFor(rows, BETO))).toBe(false);
  });

  it("hands back what somebody paid ahead of their share, and it covers no line", () => {
    const rows = nightOut();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 80_000,
      }),
    ];
    const beto = partyFor(rows, BETO);

    expect(beto).toMatchObject({ owedToYou: 0, youOwe: 20_000, net: -20_000, surplus: 20_000 });
    const plan = planSettlement(beto, 20_000);
    expect(plan).toMatchObject({ collected: 0, paid: 20_000, refunded: 20_000 });
    expect(plan.yourLines).toEqual([]);
  });

  // Owing each other the same nets to nothing, and that settle-up is still a settle-up.
  it("records both halves when the two debts cancel out", () => {
    const rows = nightOut();
    rows.expenses = [
      sharedExpense({
        id: "s1",
        description: "Food",
        date: "2026-08-10T20:00:00.000Z",
        amount: 60_000,
        split: equalSplit(60_000, [null, ANA]),
      }),
      sharedExpense({
        id: "s2",
        description: "Tickets",
        date: "2026-08-14T20:00:00.000Z",
        amount: 60_000,
        paidByContactId: ANA,
        split: equalSplit(60_000, [null, ANA]),
      }),
    ];
    const ana = partyFor(rows, ANA);

    expect(ana).toMatchObject({ owedToYou: 30_000, youOwe: 30_000, net: 0 });
    expect(hasSomethingToSettle(ana)).toBe(true);
    expect(planSettlement(ana, 0)).toMatchObject({ collected: 30_000, paid: 30_000, cash: 0 });
  });

  it("settles a block of guests over the one expense it lives in", () => {
    const rows = nightOut();
    rows.expenses = [
      sharedExpense({
        id: "s4",
        description: "Beach club",
        date: "2026-08-16T20:00:00.000Z",
        amount: 30_000,
        split: {
          mode: "EQUAL",
          guests: { count: 2, name: null },
          shares: [
            share({ party: "USER", contactId: null, amount: 10_000 }),
            share({ party: "GUESTS", contactId: null, amount: 20_000 }),
          ],
        },
      }),
    ];
    const section = sectionOf(rows, contacts);
    const [view] = section.groups;
    const block = view?.people.find((one) => one.expenseId === "s4");

    expect(block).toMatchObject({ owesYou: 20_000 });
    expect(settlePerson(section, "s4")).toBeUndefined();
  });
});

// Beto owes you 26,300 from Night out in August and 500,000 from the trip after it.
function twoGroups(): SharedLedgerRows {
  const two = [null, BETO];
  return {
    groups: [
      withTotals(sharedGroup({ id: "g1", name: "Night out" })),
      withTotals(sharedGroup({ id: "g2", name: "Cartagena trip" })),
    ],
    expenses: [
      sharedExpense({
        id: "n1",
        groupId: "g1",
        description: "Drinks",
        date: "2026-08-10T20:00:00.000Z",
        amount: 52_600,
        split: equalSplit(52_600, two),
      }),
      sharedExpense({
        id: "t1",
        groupId: "g2",
        description: "Hotel",
        date: "2026-08-30T20:00:00.000Z",
        amount: 700_000,
        split: equalSplit(700_000, two),
      }),
      sharedExpense({
        id: "t2",
        groupId: "g2",
        description: "Dinner",
        date: "2026-09-02T20:00:00.000Z",
        amount: 300_000,
        split: equalSplit(300_000, two),
      }),
    ],
    settlements: [],
    undone: [],
    dropped: [],
    unstored: new Set(),
  };
}

const betoPaid = (id: string, groupId: string, amount: number, date: string) =>
  sharedExpense({
    id,
    groupId,
    description: "Paid by Beto",
    date,
    amount: amount * 2,
    paidByContactId: BETO,
    split: equalSplit(amount * 2, [null, BETO]),
  });

function fromGroup(rows: SharedLedgerRows, groupId: string, key = `contact:${BETO}`) {
  const section = sectionOf(rows, contacts);
  const view = section.groups.find((one) => one.group.id === groupId);
  const person = view?.people.find((one) => one.key === key);
  if (!view || !person) throw new Error(`no ${key} in ${groupId}`);
  return settleParty(section, view, person);
}

const coverage = (lines: { expenseId: string; covered: number }[]) =>
  lines.map((line) => [line.expenseId, line.covered]);

describe("settling from a group", () => {
  it("proposes what is open in that group, and takes up to everything open between you", () => {
    const beto = fromGroup(twoGroups(), "g2");

    expect(beto.scope).toEqual({
      groupId: "g2",
      groupName: "Cartagena trip",
      owedToYou: 500_000,
      youOwe: 0,
      net: 500_000,
    });
    expect(beto.net).toBe(526_300);
    expect(isInbound(beto)).toBe(true);
    expect(settleableAmount(beto)).toBe(500_000);
    expect(settleCap(beto)).toBe(526_300);
  });

  it("covers that group first, oldest expense first, and sends its id", () => {
    const plan = planSettlement(fromGroup(twoGroups(), "g2"), 500_000);

    expect(plan).toMatchObject({ collected: 500_000, paid: 0, groupId: "g2" });
    expect(coverage(plan.covers)).toEqual([
      ["t1", 350_000],
      ["t2", 150_000],
    ]);
  });

  it("keeps less than the group inside it, though another group's line is older", () => {
    const plan = planSettlement(fromGroup(twoGroups(), "g2"), 200_000);

    expect(plan).toMatchObject({ collected: 200_000, paid: 0, groupId: "g2" });
    expect(coverage(plan.covers)).toEqual([["t1", 200_000]]);
  });

  it("spills what is beyond the group onto the oldest line elsewhere", () => {
    const plan = planSettlement(fromGroup(twoGroups(), "g2"), 510_000);

    expect(coverage(plan.covers)).toEqual([
      ["t1", 350_000],
      ["t2", 150_000],
      ["n1", 10_000],
    ]);
  });

  it("records both halves of the group when the amount is the group's net", () => {
    const rows = twoGroups();
    rows.expenses.push(betoPaid("t3", "g2", 100_000, "2026-09-05T20:00:00.000Z"));
    rows.expenses.push(betoPaid("n2", "g1", 20_000, "2026-08-11T20:00:00.000Z"));
    const beto = fromGroup(rows, "g2");

    expect(beto.scope).toMatchObject({ owedToYou: 500_000, youOwe: 100_000, net: 400_000 });
    const plan = planSettlement(beto, 400_000);
    expect(plan).toMatchObject({ collected: 500_000, paid: 100_000, refunded: 0, groupId: "g2" });
    expect(coverage(plan.yourLines)).toEqual([["t3", 100_000]]);
    expect(coverage(plan.covers)).toEqual([
      ["t1", 350_000],
      ["t2", 150_000],
    ]);
  });

  it("records both halves of everything when the amount is the whole net", () => {
    const rows = twoGroups();
    rows.expenses.push(betoPaid("t3", "g2", 100_000, "2026-09-05T20:00:00.000Z"));
    const beto = fromGroup(rows, "g2");

    expect(beto.net).toBe(426_300);
    const plan = planSettlement(beto, 426_300);
    expect(plan).toMatchObject({ collected: 526_300, paid: 100_000, groupId: "g2" });
    expect(coverage(plan.covers)).toEqual([
      ["t1", 350_000],
      ["t2", 150_000],
      ["n1", 26_300],
    ]);
  });

  // The owner's call: the group decides, even when the total points the other way.
  it("settles the group in its own direction when the total points the other way", () => {
    const rows = twoGroups();
    rows.expenses.push(betoPaid("n2", "g1", 726_300, "2026-08-11T20:00:00.000Z"));
    const beto = fromGroup(rows, "g2");

    expect(beto.net).toBe(-200_000);
    expect(isInbound(beto)).toBe(true);
    expect(settleableAmount(beto)).toBe(500_000);
    expect(settleCap(beto)).toBe(500_000);
    expect(planSettlement(beto, 500_000)).toMatchObject({
      collected: 500_000,
      paid: 0,
      groupId: "g2",
    });
    expect(planSettlement(beto, 300_000)).toMatchObject({ collected: 300_000, paid: 0 });
    expect(planSettlement(beto, 200_000)).toMatchObject({ collected: 200_000, paid: 0 });
  });

  it("pays the group back when you owe there, though they owe you more elsewhere", () => {
    const rows = twoGroups();
    rows.expenses = [
      ...rows.expenses.filter((one) => one.groupId === "g1"),
      betoPaid("t3", "g2", 100_000, "2026-09-05T20:00:00.000Z"),
    ];
    rows.expenses.push(
      sharedExpense({
        id: "n3",
        groupId: "g1",
        description: "Concert",
        date: "2026-08-12T20:00:00.000Z",
        amount: 400_000,
        split: equalSplit(400_000, [null, BETO]),
      }),
    );
    const beto = fromGroup(rows, "g2");

    expect(beto.net).toBe(126_300);
    expect(beto.scope).toMatchObject({ owedToYou: 0, youOwe: 100_000, net: -100_000 });
    expect(isInbound(beto)).toBe(false);
    expect(settleableAmount(beto)).toBe(100_000);
    expect(settleCap(beto)).toBe(100_000);
    expect(capIsTheGroup(beto)).toBe(true);
    const plan = planSettlement(beto, 100_000);
    expect(plan).toMatchObject({ collected: 0, paid: 100_000, refunded: 0, groupId: "g2" });
    expect(coverage(plan.yourLines)).toEqual([["t3", 100_000]]);
  });

  it("still settles a group where the two of you owe each other the same", () => {
    const rows = twoGroups();
    rows.expenses.push(betoPaid("t3", "g2", 500_000, "2026-09-05T20:00:00.000Z"));
    const beto = fromGroup(rows, "g2");

    expect(beto.scope).toMatchObject({ owedToYou: 500_000, youOwe: 500_000, net: 0 });
    expect(settleableAmount(beto)).toBe(0);
    expect(hasSomethingToSettle(beto)).toBe(true);
    expect(planSettlement(beto, 0)).toMatchObject({ collected: 500_000, paid: 500_000 });
  });

  // Paid ahead, they have nothing open here: the refund is the People door's, not this group's.
  it("has nothing to settle from a group where nothing is open with them", () => {
    const rows = twoGroups();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 540_000,
      }),
    ];
    const beto = fromGroup(rows, "g2");

    expect(beto.scope).toMatchObject({ owedToYou: 0, youOwe: 0, net: 0 });
    expect(hasSomethingToSettle(beto)).toBe(false);
    expect(hasSomethingToSettle(partyFor(rows, BETO))).toBe(true);
  });

  it("never sends a group for a block of guests", () => {
    const rows = twoGroups();
    rows.expenses.push(
      sharedExpense({
        id: "t9",
        groupId: "g2",
        description: "Beach club",
        date: "2026-09-03T20:00:00.000Z",
        amount: 30_000,
        split: {
          mode: "EQUAL",
          guests: { count: 2, name: null },
          shares: [
            share({ party: "USER", contactId: null, amount: 10_000 }),
            share({ party: "GUESTS", contactId: null, amount: 20_000 }),
          ],
        },
      }),
    );
    const block = fromGroup(rows, "g2", "guests:t9");

    expect(block.scope).toBeNull();
    expect(settleableAmount(block)).toBe(20_000);
    expect(planSettlement(block, 20_000)).toMatchObject({ collected: 20_000, groupId: null });
  });

  it("from People, has no group first: it proposes the whole and covers the oldest line", () => {
    const beto = partyFor(twoGroups(), BETO);

    expect(beto.scope).toBeNull();
    expect(settleableAmount(beto)).toBe(526_300);
    expect(settleCap(beto)).toBe(526_300);
    const plan = planSettlement(beto, 200_000);
    expect(plan.groupId).toBeNull();
    expect(coverage(plan.covers)).toEqual([
      ["n1", 26_300],
      ["t1", 173_700],
    ]);
  });
});

describe("squaring a group before a write-off", () => {
  it("crosses what you owe them there against what they owe you, and nothing elsewhere", () => {
    const rows = twoGroups();
    rows.expenses.push(betoPaid("t3", "g2", 100_000, "2026-09-05T20:00:00.000Z"));
    rows.expenses.push(betoPaid("n2", "g1", 20_000, "2026-08-11T20:00:00.000Z"));

    const plan = planCrossing(fromGroup(rows, "g2"));

    expect(plan).toMatchObject({ collected: 100_000, paid: 100_000, cash: 0, refunded: 0 });
    expect(plan?.groupId).toBe("g2");
    expect(coverage(plan?.yourLines ?? [])).toEqual([["t3", 100_000]]);
    expect(coverage(plan?.covers ?? [])).toEqual([["t1", 100_000]]);
  });

  it("crosses nothing where you owe them nothing, or outside a group", () => {
    expect(planCrossing(fromGroup(twoGroups(), "g2"))).toBeNull();
    expect(planCrossing(partyFor(nightOut(), ANA))).toBeNull();
  });
});

describe("writing off while deleting a movement", () => {
  const person = (contactId: string, owesYou: number, youOwe: number) => ({
    key: `contact:${contactId}`,
    contactId,
    expenseId: null,
    name: contactId,
    color: null,
    share: 0,
    paid: 0,
    owesYou,
    youOwe,
    net: owesYou - youOwe,
    surplus: 0,
    state: "NOT_PAID" as const,
  });

  it("is one tap only for a sole debtor you owe nothing back", () => {
    expect(writeOffWithoutCrossing([person(ANA, 60_000, 0), person(BETO, 0, 0)])?.contactId).toBe(
      ANA,
    );
    expect(writeOffWithoutCrossing([person(ANA, 60_000, 30_000)])).toBeUndefined();
    expect(
      writeOffWithoutCrossing([person(ANA, 60_000, 0), person(BETO, 10_000, 0)]),
    ).toBeUndefined();
  });
});
