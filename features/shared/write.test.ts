import { sharedGroup } from "@/lib/testing/vault";

import { expensePaidByOther } from "./write";

const ANA = "k1";
const BETO = "k2";

const group = sharedGroup({
  participants: [null, ANA, BETO].map((contactId) => ({
    contactId,
    addedAt: "2026-08-01T00:00:00.000Z",
  })),
});

describe("a line another participant paid", () => {
  it("names no movement of yours and says who paid it", () => {
    const line = expensePaidByOther(group, {
      description: "Concert tickets",
      date: "2026-09-20T17:00:00.000Z",
      amount: 90_000,
      paidByContactId: ANA,
    });

    expect(line.transactionId).toBeUndefined();
    expect(line.row.paidByContactId).toBe(ANA);
    expect(line.row.description).toBe("Concert tickets");
  });

  // It inherits the group's split without asking, exactly as picking a movement already does.
  it("inherits the group's split and carries none of its own", () => {
    const line = expensePaidByOther(group, {
      description: "Concert tickets",
      date: "2026-09-20T17:00:00.000Z",
      amount: 90_000,
      paidByContactId: ANA,
    });

    expect(line.row.customSplit).toBe(false);
    expect(line.row.split.mode).toBe("EQUAL");
    expect(line.row.split.shares.map((share) => share.amount)).toEqual([30_000, 30_000, 30_000]);
  });

  // A group that splits by percentage hands those percentages down, payer included.
  it("inherits a percentage default", () => {
    const byPercent = sharedGroup({
      participants: group.participants,
      defaultSplit: {
        mode: "PERCENT",
        shares: [
          { contactId: null, percent: 50 },
          { contactId: ANA, percent: 30 },
          { contactId: BETO, percent: 20 },
        ],
      },
    });

    const line = expensePaidByOther(byPercent, {
      description: "Hotel",
      date: "2026-09-20T17:00:00.000Z",
      amount: 200_000,
      paidByContactId: ANA,
    });

    expect(line.row.split.mode).toBe("PERCENT");
    expect(line.row.customSplit).toBe(false);
    expect(line.row.split.shares.map((share) => share.amount)).toEqual([100_000, 60_000, 40_000]);
  });

  it("keeps the id it is given, so a second try finishes the line it started", () => {
    const line = expensePaidByOther(
      group,
      {
        description: "Fuel",
        date: "2026-09-20T17:00:00.000Z",
        amount: 90_000,
        paidByContactId: ANA,
      },
      "e7",
    );

    expect(line.row.id).toBe("e7");
  });

  // The odd peso goes to whoever paid, and here that is not you (T-67).
  it("leaves the remainder with the person who paid", () => {
    const line = expensePaidByOther(group, {
      description: "Fuel",
      date: "2026-09-20T17:00:00.000Z",
      amount: 100_000,
      paidByContactId: BETO,
    });

    const byParty = new Map(
      line.row.split.shares.map((share) => [share.contactId ?? "user", share.amount]),
    );
    expect(byParty.get(BETO)).toBe(33_334);
    expect(byParty.get("user")).toBe(33_333);
    expect(byParty.get(ANA)).toBe(33_333);
  });
});
