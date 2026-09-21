import type { SharedShare } from "@/types/api";

import {
  countsAsYours,
  deriveShared,
  impute,
  type LedgerExpense,
  type LedgerSettlement,
  resolveShares,
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
