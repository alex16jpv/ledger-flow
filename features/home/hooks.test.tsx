import { renderWithProviders } from "@/lib/testing/render";
import type { Budget } from "@/types/api";

import { budgetStatus, dayBars, isGlobalMonthlyBudget, topBudgets, useMonthContext } from "./hooks";
import { homeKeys } from "./keys";

describe("home", () => {
  it("nests keys under the feature root", () => {
    expect(homeKeys.spending("a", "b", "EXPENSE")[0]).toBe("home");
  });

  it("computes the month window, day of month and yesterday in the user's zone", () => {
    const now = new Date("2026-09-22T15:00:00Z");
    let context: ReturnType<typeof useMonthContext> | undefined;
    function Probe() {
      context = useMonthContext(now);
      return null;
    }
    renderWithProviders(<Probe />, { timeZone: "America/Bogota" });
    expect(context).toMatchObject({
      from: "2026-09-01T05:00:00.000Z",
      to: "2026-10-01T05:00:00.000Z",
      dayOfMonth: 22,
      daysInMonth: 30,
      yesterdayKey: "2026-09-21",
    });
  });

  it("has no yesterday on the first day of the month", () => {
    let context: ReturnType<typeof useMonthContext> | undefined;
    function Probe() {
      context = useMonthContext(new Date("2026-09-01T12:00:00Z"));
      return null;
    }
    renderWithProviders(<Probe />, { timeZone: "America/Bogota" });
    expect(context?.yesterdayKey).toBeNull();
    expect(context?.dayOfMonth).toBe(1);
  });

  it("recognizes the global monthly budget", () => {
    const base = {
      categoryIds: [],
      periodType: "MONTHLY",
      type: "EXPENSE",
      archivedAt: null,
    } as unknown as Budget;
    expect(isGlobalMonthlyBudget(base)).toBe(true);
    expect(isGlobalMonthlyBudget({ ...base, categoryIds: ["c1"] })).toBe(false);
    expect(isGlobalMonthlyBudget({ ...base, periodType: "WEEKLY" })).toBe(false);
  });

  it("fills the month with one bar per day and marks today", () => {
    const bars = dayBars(
      [
        { key: "2026-09-02", total: 5000, count: 1, avg: 5000 },
        { key: "2026-09-22", total: 12500, count: 2, avg: 6250 },
      ],
      { from: "2026-09-01T05:00:00.000Z", daysInMonth: 30, dayOfMonth: 22 },
      "America/Bogota",
    );
    expect(bars).toHaveLength(30);
    expect(bars[1]).toEqual({ value: 5000, label: "2026-09-02", today: false });
    expect(bars[21]).toEqual({ value: 12500, label: "2026-09-22", today: true });
    expect(bars.filter((bar) => bar.value === 0)).toHaveLength(28);
  });

  it("ranks the non-global budgets by share consumed and describes their status", () => {
    const base = {
      type: "EXPENSE",
      periodType: "MONTHLY",
      archivedAt: null,
      expired: false,
      periodTo: "2026-09-30T05:00:00.000Z",
    } as unknown as Budget;
    const budgets = [
      { ...base, id: "global", categoryIds: [], amount: 2_000_000, spent: 1_284_300 },
      { ...base, id: "food", categoryIds: ["c1"], amount: 600_000, spent: 412_000 },
      { ...base, id: "transport", categoryIds: ["c2"], amount: 200_000, spent: 185_500 },
      { ...base, id: "lifestyle", categoryIds: ["c3"], amount: 300_000, spent: 356_000 },
      { ...base, id: "coffee", categoryIds: ["c4"], amount: 100_000, spent: 10_000 },
      { ...base, id: "old", categoryIds: ["c5"], amount: 100_000, spent: 99_000, expired: true },
    ];
    expect(topBudgets(budgets).map((budget) => budget.id)).toEqual([
      "lifestyle",
      "transport",
      "food",
    ]);
    const now = new Date("2026-09-22T15:00:00Z");
    expect(budgetStatus(budgets[1]!, now)).toEqual({ kind: "ok", left: 188_000 });
    expect(budgetStatus(budgets[2]!, now)).toEqual({ kind: "warn", percent: 93, daysLeft: 8 });
    expect(budgetStatus(budgets[3]!, now)).toEqual({ kind: "over", by: 56_000 });
  });
});
