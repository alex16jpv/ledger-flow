import type { Transaction } from "@/types/api";

import { amountKind, groupByDay } from "./groups";

const row = (id: string, date: string) =>
  ({ id, date, type: "EXPENSE", amount: 1, tags: [] }) as unknown as Transaction;

describe("groupByDay", () => {
  it("cuts the sorted rows where the local day changes", () => {
    const groups = groupByDay(
      [
        row("a", "2026-09-22T23:30:00Z"),
        row("b", "2026-09-22T10:00:00Z"),
        row("c", "2026-09-22T04:30:00Z"),
      ],
      "America/Bogota",
    );
    expect(groups.map((group) => [group.day, group.items.map((item) => item.id)])).toEqual([
      ["2026-09-22", ["a", "b"]],
      ["2026-09-21", ["c"]],
    ]);
  });
});

describe("amountKind", () => {
  it("signs a payment by the side of the account it moved", () => {
    const collected = { type: "SETTLEMENT", fromAccountId: null } as const;
    const givenBack = { type: "SETTLEMENT", fromAccountId: "a1" } as const;
    expect(amountKind(collected)).toBe("settlement");
    expect(amountKind(givenBack)).toBe("settlementOut");
  });

  it("reads the other four from the type alone", () => {
    expect(amountKind({ type: "EXPENSE", fromAccountId: "a1" })).toBe("expense");
    expect(amountKind({ type: "INCOME", fromAccountId: null })).toBe("income");
    expect(amountKind({ type: "TRANSFER", fromAccountId: "a1" })).toBe("transfer");
    expect(amountKind({ type: "ADJUSTMENT", fromAccountId: null })).toBe("adjustment");
  });
});
