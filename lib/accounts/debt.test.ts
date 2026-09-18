import { describe, expect, it } from "vitest";

import { readDebt, splitAccounts, takesOutsideMoney } from "@/lib/accounts/debt";
import type { Account } from "@/types/api";

const account = (over: Partial<Account>): Account => ({
  id: "a1",
  name: "Visa Gold",
  type: "CARD",
  balance: -1245900,
  openingBalance: 0,
  color: null,
  userId: "u1",
  isDefault: false,
  currency: "COP",
  archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("readDebt", () => {
  it("leaves an account that is not debt alone", () => {
    expect(readDebt(account({ type: "ACCOUNT", balance: 3420500 }))).toBeNull();
    expect(readDebt(account({ type: "CASH", balance: 184000 }))).toBeNull();
  });

  it("leads a card with what is still available, the debt under it", () => {
    expect(readDebt(account({ creditLimit: 4000000 }))).toEqual({
      lead: 2754100,
      word: "available",
      bar: 1245900 / 4000000,
      foot: { line: "owedOfLimit", owed: 1245900, limit: 4000000 },
      missing: null,
    });
  });

  it("reads an overdraft the same way as a card", () => {
    const reading = readDebt(
      account({ type: "OVERDRAFT", balance: -500000, creditLimit: 2000000 }),
    );
    expect(reading?.word).toBe("available");
    expect(reading?.lead).toBe(1500000);
  });

  it("leads a loan with what is owed, and its bar is what is paid", () => {
    expect(
      readDebt(account({ type: "LOAN", balance: -8400000, borrowedAmount: 12000000 })),
    ).toEqual({
      lead: 8400000,
      word: "owed",
      bar: 3600000 / 12000000,
      foot: { line: "paidOfBorrowed", paid: 3600000, borrowed: 12000000 },
      missing: null,
    });
  });

  it("asks for the field of its type while it is empty, and draws no bar", () => {
    expect(readDebt(account({}))).toEqual({
      lead: 1245900,
      word: "owed",
      bar: null,
      foot: null,
      missing: "creditLimit",
    });
    expect(readDebt(account({ type: "LOAN", balance: -8400000 }))?.missing).toBe("borrowedAmount");
  });

  it("never asks a card for the field a loan has", () => {
    expect(readDebt(account({ borrowedAmount: 12000000 }))?.missing).toBe("creditLimit");
    expect(readDebt(account({ type: "LOAN", balance: -1, creditLimit: 4000000 }))?.missing).toBe(
      "borrowedAmount",
    );
  });

  it("still leads with availability when nothing is owed", () => {
    expect(readDebt(account({ balance: 0, creditLimit: 4000000 }))).toEqual({
      lead: 4000000,
      word: "available",
      bar: 0,
      foot: { line: "owedOfLimit", owed: 0, limit: 4000000 },
      missing: null,
    });
  });

  it("keeps a card's availability past zero, with what is its owner's added to it", () => {
    expect(readDebt(account({ balance: 500000, creditLimit: 4000000 }))).toEqual({
      lead: 4500000,
      word: "available",
      bar: 0,
      foot: { line: "inCreditOfLimit", owed: 0, limit: 4000000, own: 500000 },
      missing: null,
    });
  });

  it("reads an overdraft in its ordinary state the same way", () => {
    const reading = readDebt(account({ type: "OVERDRAFT", balance: 320000, creditLimit: 2000000 }));
    expect(reading?.word).toBe("available");
    expect(reading?.lead).toBe(2320000);
    expect(reading?.bar).toBe(0);
  });

  it("reads a loan paid past its end as finished, with the bar full", () => {
    expect(readDebt(account({ type: "LOAN", balance: 200000, borrowedAmount: 12000000 }))).toEqual({
      lead: 0,
      word: "owed",
      bar: 1,
      foot: { line: "paidOfBorrowed", paid: 12000000, borrowed: 12000000 },
      missing: null,
    });
  });

  it("never names money of your own on a loan, because there is no such thing there", () => {
    expect(readDebt(account({ type: "LOAN", balance: 200000 }))).toEqual({
      lead: 0,
      word: "owed",
      bar: null,
      foot: null,
      missing: "borrowedAmount",
    });
  });

  it("is the state every card is in before the limit is set, and still asks for it", () => {
    expect(readDebt(account({ balance: 4000000 }))).toEqual({
      lead: 0,
      word: "owed",
      bar: null,
      foot: { line: "inCredit", amount: 4000000 },
      missing: "creditLimit",
    });
  });

  it("does not promise availability past the limit", () => {
    const reading = readDebt(account({ balance: -4300000, creditLimit: 4000000 }));
    expect(reading?.lead).toBe(0);
    expect(reading?.bar).toBe(1);
    expect(reading?.foot).toEqual({ line: "owedOfLimit", owed: 4300000, limit: 4000000 });
  });

  it("does not report a negative amount paid when a loan owes more than it took", () => {
    const reading = readDebt(
      account({ type: "LOAN", balance: -13000000, borrowedAmount: 12000000 }),
    );
    expect(reading?.bar).toBe(0);
    expect(reading?.foot).toEqual({ line: "paidOfBorrowed", paid: 0, borrowed: 12000000 });
  });

  it("treats a zero or cleared field as no field at all", () => {
    expect(readDebt(account({ creditLimit: 0 }))?.missing).toBe("creditLimit");
    expect(readDebt(account({ creditLimit: undefined }))?.missing).toBe("creditLimit");
  });

  it("adds in minor units, so two decimals do not drift", () => {
    const reading = readDebt(account({ balance: -0.1, creditLimit: 0.3 }));
    expect(reading?.lead).toBe(0.2);
  });
});

describe("splitAccounts", () => {
  it("separates what you have from what you owe, with no net figure", () => {
    expect(
      splitAccounts([
        account({ type: "ACCOUNT", balance: 3420500 }),
        account({ type: "CASH", balance: 184000 }),
        account({ type: "SAVINGS", balance: 8900000 }),
        account({ type: "CARD", balance: -1245900 }),
        account({ type: "LOAN", balance: -8400000 }),
      ]),
    ).toEqual({ have: 12504500, owe: 9645900 });
  });

  it("counts money of your own on a debt account as money you have", () => {
    expect(
      splitAccounts([
        account({ type: "CARD", balance: 4000000 }),
        account({ type: "OVERDRAFT", balance: 320000 }),
      ]),
    ).toEqual({ have: 4320000, owe: 0 });
  });

  it("does not turn an ordinary account in the red into a debt", () => {
    expect(splitAccounts([account({ type: "ACCOUNT", balance: -50000 })])).toEqual({
      have: -50000,
      owe: 0,
    });
  });
});

// T-100: into an account that holds money, money from outside is income, so the row has nothing to offer.
describe("takesOutsideMoney", () => {
  it("is the two types where an income is refused, and nothing else", () => {
    expect(takesOutsideMoney("CARD")).toBe(true);
    expect(takesOutsideMoney("LOAN")).toBe(true);
    expect(takesOutsideMoney("OVERDRAFT")).toBe(false);
    expect(takesOutsideMoney("ACCOUNT")).toBe(false);
    expect(takesOutsideMoney("SAVINGS")).toBe(false);
    expect(takesOutsideMoney("CASH")).toBe(false);
  });
});
