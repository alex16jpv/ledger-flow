import { renderWithProviders } from "@/lib/testing/render";
import type { Budget } from "@/types/api";

import { isGlobalMonthlyBudget, useMonthContext } from "./hooks";
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
});
