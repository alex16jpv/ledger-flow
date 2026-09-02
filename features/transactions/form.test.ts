import type { Transaction } from "@/types/api";

import {
  defaultFormValues,
  draftFromSearchParams,
  fromTransaction,
  isTooFarAhead,
  toTransactionInput,
  transactionFormSchema,
  type TransactionFormValues,
} from "./form";

const BOGOTA = "America/Bogota";
const NOW = new Date("2026-09-22T20:00:00Z");

function values(overrides: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return {
    ...defaultFormValues(NOW, BOGOTA),
    amount: 18400,
    accountId: "a1",
    date: "2026-09-22",
    time: "18:10",
    ...overrides,
  };
}

describe("transaction form model", () => {
  it("starts as an expense dated now in the user's zone", () => {
    expect(defaultFormValues(NOW, BOGOTA)).toMatchObject({
      type: "EXPENSE",
      date: "2026-09-22",
      time: "15:00",
      tags: [],
    });
  });

  it("maps each type to the account sides the API expects", () => {
    const base = { amount: 18400, date: "2026-09-22T23:10:00.000Z", tags: [], note: null };
    expect(toTransactionInput(values(), BOGOTA)).toEqual({
      ...base,
      type: "EXPENSE",
      categoryId: null,
      fromAccountId: "a1",
      toAccountId: null,
      description: null,
    });
    expect(toTransactionInput(values({ type: "INCOME", categoryId: "c1" }), BOGOTA)).toMatchObject({
      categoryId: "c1",
      fromAccountId: null,
      toAccountId: "a1",
    });
    expect(
      toTransactionInput(
        values({ type: "TRANSFER", fromAccountId: "a1", toAccountId: "a2", categoryId: "c1" }),
        BOGOTA,
      ),
    ).toMatchObject({ categoryId: null, fromAccountId: "a1", toAccountId: "a2" });
    expect(
      toTransactionInput(values({ type: "ADJUSTMENT", direction: "decrease" }), BOGOTA),
    ).toMatchObject({ categoryId: null, fromAccountId: "a1", toAccountId: null });
    expect(
      toTransactionInput(values({ type: "ADJUSTMENT", direction: "increase" }), BOGOTA),
    ).toMatchObject({ fromAccountId: null, toAccountId: "a1" });
  });

  it("validates accounts per type with message keys", () => {
    const issues = (input: TransactionFormValues) =>
      transactionFormSchema
        .safeParse(input)
        .error?.issues.map((i) => `${String(i.path[0])}:${i.message}`);
    expect(issues(values({ accountId: null }))).toEqual(["accountId:validation.required"]);
    expect(issues(values({ type: "TRANSFER", fromAccountId: "a1", toAccountId: "a1" }))).toEqual([
      "toAccountId:validation.sameAccount",
    ]);
    expect(issues(values({ type: "TRANSFER", fromAccountId: null, toAccountId: null }))).toEqual([
      "fromAccountId:validation.required",
      "toAccountId:validation.required",
    ]);
    expect(issues(values({ amount: Number.NaN }))).toEqual(["amount:validation.amountInvalid"]);
    expect(transactionFormSchema.safeParse(values()).success).toBe(true);
  });

  it("flags dates more than a day ahead", () => {
    expect(isTooFarAhead({ date: "2026-09-23", time: "14:00" }, BOGOTA, NOW)).toBe(false);
    expect(isTooFarAhead({ date: "2026-09-24", time: "09:00" }, BOGOTA, NOW)).toBe(true);
  });

  it("round-trips a stored transaction into form values", () => {
    const transaction = {
      id: "t1",
      type: "TRANSFER",
      amount: 500,
      date: "2026-09-22T23:10:00.000Z",
      categoryId: null,
      description: "Move",
      fromAccountId: "a1",
      toAccountId: "a2",
      userId: "u1",
      tags: ["monthly"],
      note: null,
      pendingDetails: false,
      source: "MANUAL",
      currency: "COP",
      createdAt: "",
      updatedAt: "",
    } satisfies Transaction;
    expect(fromTransaction(transaction, BOGOTA)).toMatchObject({
      type: "TRANSFER",
      accountId: null,
      fromAccountId: "a1",
      toAccountId: "a2",
      date: "2026-09-22",
      time: "18:10",
      description: "Move",
      tags: ["monthly"],
      note: "",
    });
    expect(
      fromTransaction({ ...transaction, type: "ADJUSTMENT", toAccountId: null }, BOGOTA),
    ).toMatchObject({ accountId: "a1", direction: "decrease" });
  });

  it("reads only valid draft fields from the quick-add hand-off", () => {
    expect(
      draftFromSearchParams(new URLSearchParams("amount=4500&accountId=a1&description=Bus")),
    ).toEqual({ amount: 4500, accountId: "a1", description: "Bus" });
    expect(draftFromSearchParams(new URLSearchParams("amount=abc&categoryId=c1"))).toEqual({
      categoryId: "c1",
    });
  });
});
