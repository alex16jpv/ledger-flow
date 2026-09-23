import type { SharedShare, SharedSplit } from "@/types/api";

import {
  carriedExpense,
  countsAsYours,
  deriveShared,
  impute,
  type LedgerExpense,
  type LedgerSettlement,
  resolveShares,
  splitForAmount,
  SplitInvalidError,
} from "./shared";

const YOU: SharedShare = {
  party: "USER",
  contactId: null,
  percent: null,
  fixedAmount: null,
  amount: 0,
  collected: 0,
};

const share = (over: Partial<SharedShare>): SharedShare => ({ ...YOU, ...over });

const contact = (id: string, amount: number): SharedShare =>
  share({ party: "CONTACT", contactId: id, amount });

const expense = (over: Partial<LedgerExpense> & Pick<LedgerExpense, "id">): LedgerExpense => ({
  groupId: "g1",
  date: "2026-08-10T20:00:00-05:00",
  amount: 100000,
  paidByContactId: null,
  split: { mode: "EQUAL", guests: null, shares: [] },
  deletedAt: null,
  ...over,
});

const paid = (over: Partial<LedgerSettlement> = {}): LedgerSettlement => ({
  counterparty: { kind: "CONTACT", contactId: "ana", expenseId: null },
  collected: 0,
  paid: 0,
  deletedAt: null,
  ...over,
});

describe("the split", () => {
  it("gives the odd minor unit to whoever fronted it, in a currency with no cents", () => {
    expect(
      resolveShares({
        total: 100000,
        currency: "COP",
        mode: "EQUAL",
        rows: [
          { units: 1, input: null },
          { units: 1, input: null },
          { units: 1, input: null },
        ],
        payerIndex: 0,
      }),
    ).toEqual([33334, 33333, 33333]);
  });

  it("weighs a block of guests by its head count and never hands it the remainder", () => {
    const shares = resolveShares({
      total: 100000,
      currency: "COP",
      mode: "EQUAL",
      rows: [
        { units: 1, input: null },
        { units: 1, input: null },
        { units: 1, input: null },
        { units: 20, input: null },
      ],
      payerIndex: 0,
    });
    expect(shares).toEqual([4350, 4347, 4347, 86956]);
    expect(shares.reduce((sum, one) => sum + one, 0)).toBe(100000);
  });

  it("does not depend on the order of the rows: each is floored on its own", () => {
    const rows = [
      { units: 1, input: null },
      { units: 20, input: null },
      { units: 1, input: null },
      { units: 1, input: null },
    ];
    expect(
      resolveShares({ total: 100000, currency: "COP", mode: "EQUAL", rows, payerIndex: 0 }),
    ).toEqual([4350, 86956, 4347, 4347]);
  });

  it("keeps a pinned figure and divides the rest between the others", () => {
    expect(
      resolveShares({
        total: 60000,
        currency: "COP",
        mode: "FIXED_REST",
        rows: [
          { units: 1, input: 20000 },
          { units: 1, input: null },
          { units: 1, input: null },
          { units: 1, input: null },
          { units: 1, input: null },
        ],
        payerIndex: 0,
      }),
    ).toEqual([20000, 10000, 10000, 10000, 10000]);
  });

  it("adds decimals up in minor units", () => {
    expect(
      resolveShares({
        total: 10.01,
        currency: "EUR",
        mode: "EQUAL",
        rows: [
          { units: 1, input: null },
          { units: 1, input: null },
        ],
        payerIndex: 1,
      }),
    ).toEqual([5, 5.01]);
  });

  it("refuses exact shares that do not add up", () => {
    expect(() =>
      resolveShares({
        total: 100,
        currency: "EUR",
        mode: "EXACT",
        rows: [
          { units: 1, input: 40 },
          { units: 1, input: 40 },
        ],
        payerIndex: 0,
      }),
    ).toThrow(SplitInvalidError);
  });

  it("refuses a fixed-plus-rest split with nobody to take the rest", () => {
    expect(() =>
      resolveShares({
        total: 100,
        currency: "EUR",
        mode: "FIXED_REST",
        rows: [
          { units: 1, input: 40 },
          { units: 1, input: 60 },
        ],
        payerIndex: 0,
      }),
    ).toThrow(SplitInvalidError);
  });
});

describe("the imputation", () => {
  it("covers the oldest line first, whatever order it is handed them in", () => {
    const lines = [
      { key: "b", date: "2026-08-06T12:00:00-05:00", owed: 5000 },
      { key: "a", date: "2026-08-01T12:00:00-05:00", owed: 5000 },
    ];
    expect([...impute(lines, 5000).settled]).toEqual([
      ["a", 5000],
      ["b", 0],
    ]);
    expect([...impute([...lines].reverse(), 5000).settled]).toEqual([
      ["a", 5000],
      ["b", 0],
    ]);
  });

  it("breaks a tie on the same instant by id, so two devices agree", () => {
    const lines = [
      { key: "s2", date: "2026-08-06T12:00:00-05:00", owed: 5000 },
      { key: "s1", date: "2026-08-06T12:00:00-05:00", owed: 5000 },
    ];
    expect(impute(lines, 5000).settled.get("s1")).toBe(5000);
    expect(impute([...lines].reverse(), 5000).settled.get("s1")).toBe(5000);
  });

  it("leaves what nothing was owed for on the counter", () => {
    expect(impute([{ key: "a", date: "2026-08-01T12:00:00-05:00", owed: 5000 }], 8000)).toEqual({
      settled: new Map([["a", 5000]]),
      surplus: 3000,
    });
  });
});

describe("what a payment leaves behind", () => {
  const group = { id: "g1", writeOffs: [] };

  it("takes what came back off the movement, and nothing else", () => {
    const rows = [
      expense({
        id: "s1",
        split: {
          mode: "EQUAL",
          guests: null,
          shares: [share({ amount: 50000 }), contact("ana", 50000)],
        },
      }),
    ];
    const ledger = deriveShared({
      groups: [group],
      expenses: rows,
      settlements: [paid({ collected: 20000 })],
    });
    expect(ledger.cameBack.get("s1")).toBe(20000);
    expect(countsAsYours({ amount: 100000, sharedExpenseId: "s1" }, ledger)).toBe(80000);
    expect(countsAsYours({ amount: 100000, sharedExpenseId: null }, ledger)).toBe(100000);
  });

  it("takes what you hand back off what they gave you before imputing any of it", () => {
    const theirs = expense({
      id: "s1",
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 50000 }), contact("ana", 50000)],
      },
    });
    // She paid 60,000 for a 50,000 share and you gave the 10,000 back: nothing pre-pays anything.
    const ledger = deriveShared({
      groups: [group],
      expenses: [theirs],
      settlements: [paid({ collected: 60000 }), paid({ paid: 10000 })],
    });
    expect(ledger.cameBack.get("s1")).toBe(50000);
    expect(ledger.groups[0]?.people[0]).toMatchObject({ owesYou: 0, surplus: 0, state: "PAID" });
  });

  it("leaves what somebody paid ahead as a surplus, never as collected", () => {
    const ledger = deriveShared({
      groups: [group],
      expenses: [
        expense({
          id: "s1",
          split: {
            mode: "EQUAL",
            guests: null,
            shares: [share({ amount: 50000 }), contact("ana", 50000)],
          },
        }),
      ],
      settlements: [paid({ collected: 70000 })],
    });
    expect(ledger.groups[0]).toMatchObject({ collected: 50000, owedToYou: 0, status: "SETTLED" });
    expect(ledger.groups[0]?.people[0]).toMatchObject({ surplus: 20000, state: "PAID" });
  });
});

describe("giving up on what somebody owes", () => {
  const rows = [
    expense({
      id: "s1",
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 50000 }), contact("ana", 50000)],
      },
    }),
  ];
  const written = { id: "g1", writeOffs: [{ contactId: "ana", expenseId: null, amount: 50000 }] };

  it("moves no figure of yours and clears what is owed", () => {
    const ledger = deriveShared({ groups: [written], expenses: rows, settlements: [] });
    expect(ledger.cameBack.get("s1")).toBe(0);
    expect(ledger.groups[0]).toMatchObject({ owedToYou: 0, writtenOff: 50000, status: "SETTLED" });
    expect(ledger.groups[0]?.people[0]?.state).toBe("WRITTEN_OFF");
  });

  it("keeps the ceiling it was decided against, so paying later lowers what it gives up", () => {
    const ledger = deriveShared({
      groups: [written],
      expenses: rows,
      settlements: [paid({ collected: 20000 })],
    });
    expect(ledger.groups[0]).toMatchObject({ collected: 20000, writtenOff: 30000, owedToYou: 0 });
  });
});

describe("the cases one fixture cannot hold", () => {
  const group = { id: "g1", writeOffs: [] };

  it("settles both halves of one payment, and what is left over goes back first", () => {
    // You fronted the dinner; Ana fronted the tickets. One row records both directions.
    const dinner = expense({
      id: "s1",
      date: "2026-08-10T20:00:00-05:00",
      amount: 120000,
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 60000 }), contact("ana", 60000)],
      },
    });
    const tickets = expense({
      id: "s2",
      date: "2026-08-11T18:00:00-05:00",
      amount: 60000,
      paidByContactId: "ana",
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 30000 }), contact("ana", 30000)],
      },
    });
    const ledger = deriveShared({
      groups: [group],
      expenses: [dinner, tickets],
      settlements: [paid({ collected: 60000, paid: 30000 })],
    });

    expect(ledger.collected.get("s2|user")).toBe(30000);
    expect(ledger.cameBack.get("s1")).toBe(60000);
    expect(ledger.groups[0]).toMatchObject({ owedToYou: 0, youOwe: 0, status: "SETTLED" });
  });

  it("gives back what is left of the money you handed over instead of pre-paying their next line", () => {
    const first = expense({
      id: "s1",
      date: "2026-08-10T20:00:00-05:00",
      amount: 100000,
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 50000 }), contact("ana", 50000)],
      },
    });
    const later = expense({
      id: "s2",
      date: "2026-08-20T20:00:00-05:00",
      amount: 40000,
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 20000 }), contact("ana", 20000)],
      },
    });
    // She paid 50,000, you handed 20,000 back: it comes off what she gave you, not off the next line.
    const ledger = deriveShared({
      groups: [group],
      expenses: [first, later],
      settlements: [paid({ collected: 50000 }), paid({ paid: 20000 })],
    });

    expect(ledger.cameBack.get("s1")).toBe(30000);
    expect(ledger.cameBack.get("s2")).toBe(0);
    expect(ledger.groups[0]?.people[0]).toMatchObject({ owesYou: 40000, state: "PARTIALLY_PAID" });
  });

  it("leaves a deleted expense out of every figure", () => {
    const rows = [
      expense({
        id: "s1",
        split: {
          mode: "EQUAL",
          guests: null,
          shares: [share({ amount: 50000 }), contact("ana", 50000)],
        },
      }),
      expense({
        id: "s2",
        deletedAt: "2026-08-19T00:00:00-05:00",
        split: {
          mode: "EQUAL",
          guests: null,
          shares: [share({ amount: 50000 }), contact("ana", 50000)],
        },
      }),
    ];
    const ledger = deriveShared({ groups: [group], expenses: rows, settlements: [] });
    expect(ledger.cameBack.has("s2")).toBe(false);
    expect(ledger.groups[0]).toMatchObject({ amount: 100000, owedToYou: 50000 });
  });

  it("writes off a block of guests like anybody else", () => {
    const rows = [
      expense({
        id: "s1",
        amount: 100000,
        split: {
          mode: "EQUAL",
          guests: { count: 20, name: "La oficina" },
          shares: [share({ amount: 13044 }), share({ party: "GUESTS", amount: 86956 })],
        },
      }),
    ];
    const written = { id: "g1", writeOffs: [{ contactId: null, expenseId: "s1", amount: 86956 }] };
    const ledger = deriveShared({ groups: [written], expenses: rows, settlements: [] });
    expect(ledger.groups[0]).toMatchObject({ owedToYou: 0, writtenOff: 86956, status: "SETTLED" });
    expect(ledger.groups[0]?.people[0]).toMatchObject({
      key: "guests:s1",
      expenseId: "s1",
      state: "WRITTEN_OFF",
    });
  });

  it("keeps two people who each fronted a line apart", () => {
    const mine = expense({
      id: "s1",
      date: "2026-08-10T20:00:00-05:00",
      amount: 90000,
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 30000 }), contact("ana", 30000), contact("beto", 30000)],
      },
    });
    const hers = expense({
      id: "s2",
      date: "2026-08-11T18:00:00-05:00",
      amount: 90000,
      paidByContactId: "ana",
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 30000 }), contact("ana", 30000), contact("beto", 30000)],
      },
    });
    const his = expense({
      id: "s3",
      date: "2026-08-12T18:00:00-05:00",
      amount: 60000,
      paidByContactId: "beto",
      split: {
        mode: "EQUAL",
        guests: null,
        shares: [share({ amount: 20000 }), contact("ana", 20000), contact("beto", 20000)],
      },
    });
    // What you hand over covers only the lines that person fronted.
    const ledger = deriveShared({
      groups: [group],
      expenses: [mine, hers, his],
      settlements: [paid({ paid: 30000 })],
    });

    expect(ledger.collected.get("s2|user")).toBe(30000);
    expect(ledger.collected.get("s3|user")).toBe(0);
    expect(ledger.groups[0]?.people.map((one) => [one.key, one.owesYou, one.youOwe])).toEqual([
      ["contact:ana", 30000, 0],
      ["contact:beto", 30000, 20000],
    ]);
  });
});

describe("the same split over a new amount, as an edited movement carries it", () => {
  const split = (
    mode: SharedSplit["mode"],
    shares: SharedShare[],
    guests: SharedSplit["guests"] = null,
  ): SharedSplit => ({
    mode,
    guests,
    shares,
  });
  const amounts = (resolved: SharedSplit) => resolved.shares.map((one) => one.amount);

  it("splits equally again and hands the odd unit to whoever fronted it", () => {
    const stored = split("EQUAL", [
      share({ amount: 50000 }),
      contact("ana", 50000),
      contact("leo", 0),
    ]);
    expect(amounts(splitForAmount(stored, 100000, "COP", "ana"))).toEqual([33333, 33334, 33333]);
    expect(amounts(splitForAmount(stored, 100000, "COP", null))).toEqual([33334, 33333, 33333]);
  });

  it("keeps the percentages and weighs a block of guests by its head count", () => {
    const percent = split("PERCENT", [
      share({ percent: 25, amount: 25000 }),
      share({ party: "CONTACT", contactId: "ana", percent: 75, amount: 75000 }),
    ]);
    expect(amounts(splitForAmount(percent, 80000, "COP", null))).toEqual([20000, 60000]);

    const guests = split("EQUAL", [share({ amount: 0 }), share({ party: "GUESTS", amount: 0 })], {
      count: 3,
      name: null,
    });
    expect(amounts(splitForAmount(guests, 80000, "COP", null))).toEqual([20000, 60000]);
  });

  it("keeps what was pinned and gives the rest to whoever takes it", () => {
    const fixed = split("FIXED_REST", [
      share({ amount: 70000 }),
      share({ party: "CONTACT", contactId: "ana", fixedAmount: 30000, amount: 30000 }),
    ]);
    const resolved = splitForAmount(fixed, 50000, "COP", null);
    expect(amounts(resolved)).toEqual([20000, 30000]);
    expect(resolved.shares[1]?.fixedAmount).toBe(30000);
  });

  it("refuses an exact split, whose amounts stop adding up, as the server does", () => {
    const exact = split("EXACT", [
      share({ fixedAmount: 40000, amount: 40000 }),
      share({ party: "CONTACT", contactId: "ana", fixedAmount: 60000, amount: 60000 }),
    ]);
    expect(() => splitForAmount(exact, 90000, "COP", null)).toThrow(SplitInvalidError);
  });

  it("refuses a share of guests with no block to count them", () => {
    const orphan = split("EQUAL", [share({ amount: 0 }), share({ party: "GUESTS", amount: 0 })]);
    expect(() => splitForAmount(orphan, 80000, "COP", null)).toThrow(SplitInvalidError);
  });

  it("carries the date and the description, and leaves the split alone when the amount holds", () => {
    const stored = {
      amount: 100000,
      date: "2026-08-10T20:00:00.000Z",
      description: "Cena",
      currency: "COP",
      paidByContactId: null,
      // Even an exact split survives a movement whose amount did not move.
      split: split("EXACT", [share({ fixedAmount: 100000, amount: 100000 })]),
    };
    const carried = carriedExpense(stored, { date: "2026-08-11T20:00:00.000Z", description: null });
    expect(carried).toEqual({ ...stored, date: "2026-08-11T20:00:00.000Z", description: null });
    expect(carried.split).toBe(stored.split);
  });
});
