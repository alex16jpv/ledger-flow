import type { Transaction } from "@/types/api";

import { groupByDay } from "./groups";

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
