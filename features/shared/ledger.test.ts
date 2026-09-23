import type { SharedLedgerRows } from "@/lib/local/repository";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { sectionOf } from "./ledger";

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

// The list endpoint answers totals and a status; the mirror works the same two out on every read.
const withTotals = (
  row: SyncSharedGroup,
  totals: Partial<SharedGroup["totals"]> = {},
): SharedGroup => ({
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
    ...totals,
  },
});

const equalSplit = (amount: number, people: (string | null)[], guests?: number) => ({
  mode: "EQUAL" as const,
  guests: guests === undefined ? null : { count: guests, name: null },
  shares: people.map((contactId) =>
    share({
      party: contactId === null ? "USER" : "CONTACT",
      contactId,
      amount: amount / (people.length + (guests ?? 0)),
    }),
  ),
});

const contacts = [contact({ id: ANA, name: "Ana Ruiz" }), contact({ id: BETO, name: "Beto Cano" })];

// The owner's own example: 120,000 and 60,000 fronted by you, 90,000 of tickets fronted by Ana.
function nightOut(): SharedLedgerRows {
  const three = [null, ANA, BETO];
  return {
    groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
    expenses: [
      sharedExpense({
        id: "s1",
        description: "Food",
        amount: 120_000,
        split: equalSplit(120_000, three),
      }),
      sharedExpense({
        id: "s2",
        description: "Fuel",
        amount: 60_000,
        split: equalSplit(60_000, three),
      }),
      sharedExpense({
        id: "s3",
        description: "Tickets",
        amount: 90_000,
        paidByContactId: ANA,
        split: equalSplit(90_000, three),
      }),
    ],
    settlements: [],
    undone: [],
    dropped: [],
  };
}

describe("the section a screen reads", () => {
  it("nets each person over every group, and never adds the two directions together", () => {
    const section = sectionOf(nightOut(), contacts);

    // Ana owes you 60,000 of your two lines and you owe her 30,000 of hers: she sends 30,000.
    expect(section.people).toEqual([
      expect.objectContaining({ name: "Beto Cano", owesYou: 60_000, youOwe: 0, net: 60_000 }),
      expect.objectContaining({ name: "Ana Ruiz", owesYou: 60_000, youOwe: 30_000, net: 30_000 }),
    ]);
    expect(section.owedToYou).toBe(90_000);
    expect(section.youOwe).toBe(0);
  });

  it("leads a group with what left your accounts and has not come back", () => {
    const [view] = sectionOf(nightOut(), contacts).groups;

    // 180,000 of the 270,000 left your accounts; the tickets are not an expense of yours.
    expect(view?.countsAsYours).toBe(180_000);
    expect(view?.owed).toBe(90_000);
    expect(view?.barTotal).toBe(90_000);
    expect(view?.you.share).toBe(90_000);
  });

  it("takes a payment off what still counts as yours, in the group it was imputed to", () => {
    const rows = nightOut();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 60_000,
      }),
    ];
    const section = sectionOf(rows, contacts);
    const [view] = section.groups;

    expect(view?.countsAsYours).toBe(120_000);
    expect(view?.collected).toBe(60_000);
    expect(view?.people.find((one) => one.contactId === BETO)).toMatchObject({
      state: "PAID",
      owesYou: 0,
      paid: 60_000,
    });
    expect(section.owedToYou).toBe(30_000);
  });

  // Decision 2.3: writing off moves no figure. It was counted as yours from the day you paid.
  it("gives up on what somebody owes without moving what counts as yours", () => {
    const rows = nightOut();
    rows.groups = [
      withTotals(
        sharedGroup({
          id: "g1",
          name: "Night out",
          writeOffs: [
            {
              kind: "CONTACT",
              contactId: BETO,
              expenseId: null,
              amount: 60_000,
              at: "2026-08-20T00:00:00.000Z",
            },
          ],
        }),
      ),
    ];
    const section = sectionOf(rows, contacts);
    const [view] = section.groups;

    expect(view?.countsAsYours).toBe(180_000);
    expect(view?.writtenOff).toBe(60_000);
    expect(view?.owed).toBe(30_000);
    // The bar still says what was ever owed to you: 60,000 given up plus Ana's 30,000.
    expect(view?.barTotal).toBe(90_000);
    expect(view?.people.find((one) => one.contactId === BETO)?.state).toBe("WRITTEN_OFF");
    // Nobody is owed any more, so the row folds away with the settled ones instead of vanishing.
    expect(section.people.find((one) => one.contactId === BETO)?.net).toBe(0);
  });

  // Decision 20: a block of guests is somebody to collect from, and never a row on People.
  it("counts a block of guests in what is owed to you, and keeps it out of the people", () => {
    const rows: SharedLedgerRows = {
      groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
      expenses: [
        sharedExpense({
          id: "s1",
          description: "Beach club",
          amount: 230_000,
          split: {
            mode: "EQUAL",
            guests: { count: 20, name: null },
            shares: [
              share({ party: "USER", contactId: null, amount: 10_000 }),
              share({ contactId: ANA, amount: 10_000 }),
              share({ contactId: BETO, amount: 10_000 }),
              share({ party: "GUESTS", amount: 200_000 }),
            ],
          },
        }),
      ],
      settlements: [],
      undone: [],
      dropped: [],
    };
    const section = sectionOf(rows, contacts);

    expect(section.people.map((one) => one.name)).toEqual(["Ana Ruiz", "Beto Cano"]);
    expect(section.guests).toEqual({ owed: 200_000, groupCount: 1 });
    expect(section.owedToYou).toBe(220_000);
    expect(section.groups[0]?.people.find((one) => one.expenseId === "s1")).toMatchObject({
      name: "Beach club",
      owesYou: 200_000,
    });
  });

  // The imputation is per counterparty, not per group: the surplus is the same figure in each.
  it("counts what somebody paid ahead once, however many groups they are in", () => {
    const rows = nightOut();
    rows.groups = [...rows.groups, withTotals(sharedGroup({ id: "g2", name: "Office lunch" }))];
    rows.expenses = [
      ...rows.expenses,
      sharedExpense({
        id: "s4",
        groupId: "g2",
        description: "Lunch",
        amount: 60_000,
        split: equalSplit(60_000, [null, BETO]),
      }),
    ];
    // Beto owes 60,000 of the night out and 30,000 of the lunch, and hands over 120,000.
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 120_000,
      }),
    ];
    const section = sectionOf(rows, contacts);
    const beto = section.people.find((one) => one.contactId === BETO);

    expect(beto).toMatchObject({ owesYou: 0, youOwe: 30_000, net: -30_000 });
    expect(section.youOwe).toBe(30_000);
    // The same surplus shows on their row in each group and must never be added up.
    expect(
      section.groups.map((view) => view.people.find((one) => one.contactId === BETO)?.surplus),
    ).toEqual([30_000, 30_000]);
  });

  // The other direction: what you handed over on a line they fronted is not money that came back.
  it("takes what you paid them off what you owe, and never off what they owe you", () => {
    const rows = nightOut();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
        paid: 30_000,
      }),
    ];
    const section = sectionOf(rows, contacts);
    const [view] = section.groups;
    const ana = view?.people.find((one) => one.contactId === ANA);

    expect(ana).toMatchObject({ owesYou: 60_000, youOwe: 0, paid: 0 });
    expect(view?.collected).toBe(0);
    // Paying her back is an expense of yours and it is this outing's cost: 180,000 + 30,000.
    expect(view?.countsAsYours).toBe(210_000);
    expect(section.people.find((one) => one.contactId === ANA)?.net).toBe(60_000);
  });

  // A share that falls under what they already paid is their money in your account, not a state.
  it("moves somebody who paid more than their share over to what you owe", () => {
    const rows = nightOut();
    rows.settlements = [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
        collected: 100_000,
      }),
    ];
    const section = sectionOf(rows, contacts);
    const beto = section.people.find((one) => one.contactId === BETO);

    expect(beto).toMatchObject({ owesYou: 0, youOwe: 40_000, net: -40_000 });
    expect(section.youOwe).toBe(40_000);
    expect(section.groups[0]?.people.find((one) => one.contactId === BETO)?.surplus).toBe(40_000);
  });
});
