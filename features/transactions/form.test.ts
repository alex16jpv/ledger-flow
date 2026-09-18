import type { Transaction } from "@/types/api";

import {
  defaultFormValues,
  draftFromSearchParams,
  draftToFormValues,
  fromTransaction,
  isFormTransaction,
  isTooFarAhead,
  toTransactionChanges,
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
    ).toMatchObject({ categoryId: "c1", fromAccountId: "a1", toAccountId: "a2" });
  });

  // T-85: the form offers three types, because an adjustment is made inside the account.
  it("refuses a type this form does not offer", () => {
    expect(transactionFormSchema.safeParse({ ...values(), type: "ADJUSTMENT" }).success).toBe(
      false,
    );
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

  it("writes a transfer paid from outside as a one-sided adjustment", () => {
    expect(
      toTransactionInput(
        values({
          type: "TRANSFER",
          fromAccountId: null,
          toAccountId: "a2",
          categoryId: "c1",
          fromOutside: true,
        }),
        BOGOTA,
      ),
    ).toMatchObject({
      type: "ADJUSTMENT",
      categoryId: null,
      fromAccountId: null,
      toAccountId: "a2",
    });
  });

  it("keeps the From out of the payload even if an account was chosen before", () => {
    expect(
      toTransactionInput(
        values({ type: "TRANSFER", fromAccountId: "a1", toAccountId: "a2", fromOutside: true }),
        BOGOTA,
      ),
    ).toMatchObject({ type: "ADJUSTMENT", fromAccountId: null, toAccountId: "a2" });
  });

  it("leaves the other two types alone when the flag is somehow set", () => {
    expect(toTransactionInput(values({ fromOutside: true }), BOGOTA)).toMatchObject({
      type: "EXPENSE",
      fromAccountId: "a1",
    });
  });

  it("stops asking for a From once the money comes from outside", () => {
    const issues = (input: TransactionFormValues) =>
      transactionFormSchema
        .safeParse(input)
        .error?.issues.map((i) => `${String(i.path[0])}:${i.message}`);
    expect(issues(values({ type: "TRANSFER", fromAccountId: null, toAccountId: "a2" }))).toEqual([
      "fromAccountId:validation.required",
    ]);
    expect(
      transactionFormSchema.safeParse(
        values({ type: "TRANSFER", fromAccountId: null, toAccountId: "a2", fromOutside: true }),
      ).success,
    ).toBe(true);
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
      dayKey: "2026-09-22",
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
    expect(isFormTransaction({ ...transaction, type: "ADJUSTMENT" })).toBe(false);
    expect(isFormTransaction(transaction)).toBe(true);
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

describe("what an edit sends", () => {
  const input = {
    type: "EXPENSE" as const,
    amount: 30_000,
    date: "2026-09-06T12:00:00.000Z",
    categoryId: "c1",
    fromAccountId: "a1",
    toAccountId: null,
    description: "Taxi",
    tags: ["work"],
    note: "Airport run",
  };

  it("sends only the fields the user touched", () => {
    expect(toTransactionChanges(input, { note: true })).toEqual({ note: "Airport run" });
  });

  it("sends the date when either the day or the time moved", () => {
    expect(toTransactionChanges(input, { time: true })).toEqual({ date: input.date });
    expect(toTransactionChanges(input, { date: true })).toEqual({ date: input.date });
  });

  it("sends both sides and the category when the type changed", () => {
    expect(toTransactionChanges(input, { type: true })).toEqual({
      type: "EXPENSE",
      categoryId: "c1",
      fromAccountId: "a1",
      toAccountId: null,
    });
  });

  it("sends both sides when the single account picker moved, because either side may be it", () => {
    expect(toTransactionChanges(input, { accountId: true })).toEqual({
      fromAccountId: "a1",
      toAccountId: null,
    });
  });

  it("sends the type, both sides, the category and the description when the money came from outside", () => {
    expect(toTransactionChanges({ ...input, type: "ADJUSTMENT" }, { fromOutside: true })).toEqual({
      type: "ADJUSTMENT",
      categoryId: "c1",
      fromAccountId: "a1",
      toAccountId: null,
      description: "Taxi",
    });
  });

  it("sends nothing when nothing was touched", () => {
    expect(toTransactionChanges(input, {})).toEqual({});
  });
});

// T-73: the quick sheet now hands over a type and, for a transfer, a second account.
describe("the draft the quick sheet hands to the full form", () => {
  const base = defaultFormValues(NOW, BOGOTA);

  it("reads the type only when the contract has it", () => {
    expect(draftFromSearchParams(new URLSearchParams("type=TRANSFER")).type).toBe("TRANSFER");
    expect(draftFromSearchParams(new URLSearchParams("type=SOMETHING")).type).toBeUndefined();
    expect(draftFromSearchParams(new URLSearchParams("")).type).toBeUndefined();
  });

  it("puts a transfer's one account on the side it leaves from", () => {
    const draft = draftFromSearchParams(
      new URLSearchParams("type=TRANSFER&amount=3000&accountId=a1&toAccountId=a2"),
    );

    expect(draftToFormValues(draft, base)).toMatchObject({
      type: "TRANSFER",
      amount: 3000,
      accountId: null,
      fromAccountId: "a1",
      toAccountId: "a2",
      categoryId: null,
    });
  });

  it("carries the category over, because every type this form offers takes one (T-86)", () => {
    const income = draftToFormValues(
      draftFromSearchParams(new URLSearchParams("type=INCOME&accountId=a1&categoryId=c1")),
      base,
    );
    expect(income).toMatchObject({
      type: "INCOME",
      accountId: "a1",
      fromAccountId: null,
      toAccountId: null,
      categoryId: "c1",
    });

    const transfer = draftToFormValues(
      draftFromSearchParams(new URLSearchParams("type=TRANSFER&accountId=a1&categoryId=c1")),
      base,
    );
    expect(transfer).toMatchObject({ fromAccountId: "a1", categoryId: "c1" });
  });

  it("falls back to the form's own type when the draft carries none", () => {
    expect(
      draftToFormValues(draftFromSearchParams(new URLSearchParams("amount=100")), base),
    ).toMatchObject({ type: "EXPENSE", amount: 100 });
  });
});
