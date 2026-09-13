import { fromCents, runningTotals, sumAmounts, toCents } from "./money";

describe("money", () => {
  it("adds in minor units, which floats cannot do", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("carries a running total without the drift of adding as it goes", () => {
    expect(runningTotals([0.1, 0.2, 0.3])).toEqual([0.1, 0.3, 0.6]);
  });

  it("keeps one point per amount, in the order they arrived", () => {
    expect(runningTotals([1_000, 0, 2_500])).toEqual([1_000, 1_000, 3_500]);
    expect(runningTotals([])).toEqual([]);
  });

  it("rounds to minor units the way the server does", () => {
    expect(toCents(10.005)).toBe(1001);
    expect(fromCents(1001)).toBe(10.01);
  });
});
