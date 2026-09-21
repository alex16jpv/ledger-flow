import { sharedGroup } from "@/lib/testing/vault";
import type { Transaction } from "@/types/api";

import {
  GUESTS_KEY,
  leftToAssign,
  partiesOf,
  resolveDraft,
  type SplitDraft,
  USER_KEY,
} from "./split";
import { expenseFromTransaction, groupDefaultSplit, inheritedSplit } from "./write";

const ANA = "k1";
const BETO = "k2";

const three = [
  { contactId: null, name: "You", color: null },
  { contactId: ANA, name: "Ana", color: null },
  { contactId: BETO, name: "Beto", color: null },
];

const draft = (over: Partial<SplitDraft> = {}): SplitDraft => ({
  mode: "EQUAL",
  guests: null,
  inputs: {},
  ...over,
});

const amounts = (input: SplitDraft, parties = partiesOf(three, input.guests), total = 100_000) =>
  resolveDraft(input, parties, total, "COP", USER_KEY).map((share) => share.amount);

describe("the split a sheet is filling in", () => {
  // T-67: $100,000 does not divide by three and the peso has no cents.
  it("gives the odd unit to whoever paid, so the shares add up to the expense", () => {
    expect(amounts(draft())).toEqual([33_334, 33_333, 33_333]);

    const parties = partiesOf(three, null);
    const paidByAna = resolveDraft(draft(), parties, 100_000, "COP", ANA).map((one) => one.amount);
    expect(paidByAna).toEqual([33_333, 33_334, 33_333]);
  });

  it("splits by percentage, by exact amounts and by a fixed share with the rest shared", () => {
    expect(
      amounts(draft({ mode: "PERCENT", inputs: { [USER_KEY]: 50, [ANA]: 30, [BETO]: 20 } })),
    ).toEqual([50_000, 30_000, 20_000]);
    expect(
      amounts(
        draft({ mode: "EXACT", inputs: { [USER_KEY]: 60_000, [ANA]: 25_000, [BETO]: 15_000 } }),
      ),
    ).toEqual([60_000, 25_000, 15_000]);
    // "Pepito only pays 50": the rest keeps splitting itself between the other two.
    expect(amounts(draft({ mode: "FIXED_REST", inputs: { [BETO]: 20_000 } }))).toEqual([
      40_000, 40_000, 20_000,
    ]);
  });

  // Decision 20: the guests weigh as many shares as there are of them, and pay as one row.
  it("counts a block of guests as its head count and collects from it as one", () => {
    const guests = { count: 20, name: null };
    const parties = partiesOf(three, guests);
    expect(parties.at(-1)).toMatchObject({ key: GUESTS_KEY, units: 20 });
    expect(amounts(draft({ guests }), parties, 230_000)).toEqual([10_000, 10_000, 10_000, 200_000]);
  });

  it("says what is left to assign, which is what the sheet refuses to be saved with", () => {
    const parties = partiesOf(three, null);
    expect(leftToAssign(draft(), parties, 100_000)).toBe(0);
    expect(
      leftToAssign(draft({ mode: "PERCENT", inputs: { [USER_KEY]: 50 } }), parties, 100_000),
    ).toBe(50_000);
    expect(
      leftToAssign(draft({ mode: "EXACT", inputs: { [USER_KEY]: 60_000 } }), parties, 100_000),
    ).toBe(40_000);
    // Under fixed plus rest whoever is not pinned takes what is left, so nothing is ever left over.
    expect(
      leftToAssign(draft({ mode: "FIXED_REST", inputs: { [BETO]: 20_000 } }), parties, 100_000),
    ).toBe(0);
  });

  it("refuses a split that does not add up to the expense", () => {
    const parties = partiesOf(three, null);
    const percent = (inputs: Record<string, number>) =>
      resolveDraft(draft({ mode: "PERCENT", inputs }), parties, 100_000, "COP", USER_KEY);

    expect(() => percent({ [USER_KEY]: 50 })).toThrow(/its own figure/);
    expect(() => percent({ [USER_KEY]: 50, [ANA]: 30, [BETO]: 10 })).toThrow(/add up to 100/);
  });
});

describe("what a new expense inherits", () => {
  const group = {
    ...sharedGroup({
      id: "g1",
      participants: [
        { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
        { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
      ],
    }),
  };

  it("takes the group's default without asking, and does not read as its own split", () => {
    const transaction = {
      id: "t1",
      amount: 80_000,
      date: "2026-08-10T20:00:00.000Z",
      description: "Dinner",
    } as Transaction;

    const { row, transactionId } = expenseFromTransaction(group, transaction);
    expect(transactionId).toBe("t1");
    expect(row.customSplit).toBe(false);
    expect(row.split.shares.map((one) => one.amount)).toEqual([40_000, 40_000]);
    // The three fields are the transaction's, and the body must never repeat them.
    expect(row).toMatchObject({ amount: 80_000, date: transaction.date, description: "Dinner" });
  });

  it("carries each person's figure when the default is a percentage", () => {
    const byPercent = {
      ...group,
      defaultSplit: {
        mode: "PERCENT" as const,
        shares: [
          { contactId: null, percent: 70 },
          { contactId: ANA, percent: 30 },
        ],
      },
    };
    expect(inheritedSplit(byPercent, 100_000).shares.map((one) => one.amount)).toEqual([
      70_000, 30_000,
    ]);
  });

  it("builds the group's own default from what the form typed", () => {
    expect(groupDefaultSplit("EQUAL", [null, ANA], {})).toEqual({ mode: "EQUAL", shares: [] });
    expect(groupDefaultSplit("PERCENT", [null, ANA], { [USER_KEY]: "60", [ANA]: "40" })).toEqual({
      mode: "PERCENT",
      shares: [
        { contactId: null, percent: 60 },
        { contactId: ANA, percent: 40 },
      ],
    });
  });
});
