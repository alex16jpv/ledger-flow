import type { SharedLedgerRows } from "@/lib/local/repository";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { sectionOf } from "./ledger";
import { hasSomethingToSettle, planSettlement, settleableAmount, settlePerson } from "./settle";

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
