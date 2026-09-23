import { joinedExpense, joinedGroup, transaction } from "@/lib/testing/vault";
import type { JoinedExpense } from "@/types/api";

import { deriveJoined } from "./joined";

type Share = JoinedExpense["split"]["shares"][number];

const share = (contactId: string | null, amount: number, collected = 0): Share => ({
  party: contactId === null ? "USER" : "CONTACT",
  contactId,
  percent: null,
  fixedAmount: null,
  amount,
  collected,
});

const line = (id: string, shares: Share[], overrides: Partial<JoinedExpense> = {}) =>
  joinedExpense({
    id,
    amount: shares.reduce((sum, s) => sum + s.amount, 0),
    split: { mode: "EQUAL", guests: null, shares },
    ...overrides,
  });

describe("deriveJoined", () => {
  const cabin = line("cabin", [
    share(null, 300000),
    share("k2", 300000, 300000),
    share("k3", 300000),
  ]);
  const groceries = line("groceries", [
    share(null, 80000),
    share("k2", 80000, 80000),
    share("k3", 80000),
  ]);
  const dinner = line("dinner", [share(null, 80000), share("k2", 80000), share("k3", 80000)], {
    date: "2026-09-20T15:00:00.000Z",
  });
  const horses = line("horses", [share(null, 50000), share("k2", 50000), share("k3", 50000)], {
    paidByContactId: "k3",
  });
  const added = transaction({
    id: "t-cabin",
    amount: 300000,
    importedFromGroupId: "g9",
    importedFromExpenseId: "cabin",
  });

  it("reads each line from your side: in your ledger, ready, not paid, or somebody else's", () => {
    const standing = deriveJoined(joinedGroup(), [cabin, groceries, dinner, horses], [added]);

    expect(standing.lines.map((l) => [l.id, l.state])).toEqual([
      ["cabin", "IN_LEDGER"],
      ["groceries", "PAID"],
      ["dinner", "NOT_PAID"],
      ["horses", "OTHER_PAID"],
    ]);
    expect(standing.ready).toEqual(["groceries"]);
    expect(standing.lines[0]).toMatchObject({ addedId: "t-cabin", addedAmount: 300000 });
  });

  it("says what you owe the owner over her lines, and the bar of what you paid of it", () => {
    const standing = deriveJoined(joinedGroup(), [cabin, groceries, dinner, horses], []);

    expect(standing).toMatchObject({
      youOwe: 80000,
      paidToOwner: 380000,
      owedToOwner: 460000,
      state: "PARTIALLY_PAID",
      yourShare: 510000,
      amount: 1530000,
    });
  });

  it("gives what she wrote off no line to add, and moves nothing", () => {
    const group = joinedGroup({
      writeOffs: [
        {
          kind: "CONTACT",
          contactId: "k2",
          expenseId: null,
          amount: 80000,
          at: "2026-09-22T10:00:00.000Z",
        },
      ],
    });

    const standing = deriveJoined(group, [groceries, dinner], []);

    expect(standing.state).toBe("WRITTEN_OFF");
    expect(standing.youOwe).toBe(0);
    expect(standing.lines.map((l) => l.state)).toEqual(["PAID", "WRITTEN_OFF"]);
  });

  it("counts what the owner owes you on a line you paid", () => {
    const fuel = line("fuel", [share(null, 40000, 10000), share("k2", 40000)], {
      paidByContactId: "k2",
    });

    const standing = deriveJoined(joinedGroup(), [fuel], []);

    expect(standing.ownerOwes).toBe(30000);
    expect(standing.lines[0]?.state).toBe("YOU_PAID");
  });

  it("keeps a line you added in your ledger after the owner undoes the payment, and says so", () => {
    const undone = line("cabin", [share(null, 300000), share("k2", 300000, 0)]);

    const [first] = deriveJoined(joinedGroup(), [undone], [added]).lines;

    expect(first).toMatchObject({ state: "IN_LEDGER", stillPaid: false });
  });

  it("ignores a deleted line and an added expense you deleted", () => {
    const standing = deriveJoined(
      joinedGroup(),
      [groceries, { ...dinner, deletedAt: "2026-09-21T00:00:00.000Z" }],
      [{ ...added, importedFromExpenseId: "groceries", deletedAt: "2026-09-22T00:00:00.000Z" }],
    );

    expect(standing.lines.map((l) => [l.id, l.state])).toEqual([["groceries", "PAID"]]);
  });
});
