import type { DaySlot } from "@/lib/charts/days";

import { hasPeriodHistory, paceSeries } from "./charts";

const days = (values: (number | null)[]): DaySlot[] =>
  values.map((value, index) => ({
    key: `2026-09-${String(index + 1).padStart(2, "0")}`,
    value: value ?? 0,
    future: value === null,
  }));

describe("paceSeries", () => {
  it("adds the day buckets in minor units, so the curve is not a float sum", () => {
    const series = paceSeries(days([10.01, 0.01, 0.01, null]), 100);
    expect(series.spent).toEqual([0, 10.01, 10.02, 10.03, null]);
    expect(series.spentSoFar).toBe(10.03);
  });

  it("draws the pace as a straight line from nothing to the period's limit", () => {
    const series = paceSeries(days([0, 0, null, null]), 400);
    expect(series.pace).toEqual([0, 100, 200, 300, 400]);
  });

  it("projects from today's total at the rate of the days that have passed", () => {
    const series = paceSeries(days([100, 100, null, null]), 300);
    expect(series.elapsedDays).toBe(2);
    expect(series.endsAt).toBe(400);
    // The gap before today is a gap: a projection never reaches back over days that happened.
    expect(series.projection).toEqual([null, null, 200, 300, 400]);
  });

  it("does not project from a single elapsed day", () => {
    const series = paceSeries(days([100, null, null, null]), 300);
    expect(series.projection).toBeNull();
    expect(series.endsAt).toBeNull();
    expect(series.elapsedDays).toBe(1);
  });

  it("does not project a period that is over, or one with nothing spent", () => {
    expect(paceSeries(days([100, 100, 100, 100]), 300).projection).toBeNull();
    expect(paceSeries(days([0, 0, null, null]), 300).projection).toBeNull();
  });

  it("has no history to line a CUSTOM budget up against", () => {
    expect(hasPeriodHistory({ periodType: "CUSTOM" })).toBe(false);
    expect(hasPeriodHistory({ periodType: "MONTHLY" })).toBe(true);
  });
});
