import { monthWindow, shiftMonth } from "@/lib/format/dates";
import type { StatsBucket } from "@/types/api";

import {
  categoryMix,
  monthComparison,
  OTHER_KEY,
  savings,
  trendMonths,
  trendWindow,
} from "./trends";

const TZ = "America/Bogota";
const SEPTEMBER = new Date("2026-09-22T15:00:00.000Z");

const bucket = (key: string, total: number): StatsBucket => ({
  key,
  total,
  count: 1,
  avg: total,
});

describe("trendWindow", () => {
  it("spans the months asked for and ends on the month it was given", () => {
    const window = trendWindow(SEPTEMBER, 6, TZ);
    expect(window.from.toISOString()).toBe("2026-04-01T05:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });
});

describe("trendMonths", () => {
  const window = trendWindow(SEPTEMBER, 6, TZ);

  it("starts where the data starts instead of padding the months before it with zeros", () => {
    const months = trendMonths(
      [bucket("2026-08", 4_200_000)],
      [bucket("2026-07", 1_100_000), bucket("2026-09", 815_900)],
      window,
      6,
      TZ,
      "2026-09",
    );
    expect(months.map((month) => month.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(months.map((month) => month.spending)).toEqual([1_100_000, 0, 815_900]);
    expect(months.map((month) => month.income)).toEqual([0, 4_200_000, 0]);
  });

  it("names a month by its own first instant, so a zone behind UTC keeps its name", () => {
    const months = trendMonths([bucket("2026-09", 10)], [], window, 6, TZ, null);
    expect(months).toHaveLength(1);
    expect(months[0]?.from.toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });

  it("marks only the month still running", () => {
    const months = trendMonths(
      [],
      [bucket("2026-08", 10), bucket("2026-09", 20)],
      window,
      6,
      TZ,
      "2026-09",
    );
    expect(months.map((month) => month.running)).toEqual([false, true]);
  });

  it("has nothing to draw when the range holds nothing", () => {
    expect(trendMonths([], [], window, 6, TZ, "2026-09")).toEqual([]);
  });
});

describe("savings", () => {
  const window = trendWindow(SEPTEMBER, 6, TZ);
  const months = trendMonths(
    [bucket("2026-08", 4_200_000), bucket("2026-09", 4_200_000)],
    [bucket("2026-08", 1_855_000), bucket("2026-09", 815_900)],
    window,
    6,
    TZ,
    "2026-09",
  );

  it("takes the running month off the totals the API returned instead of adding the buckets up", () => {
    // The range totals carry a month the bucket list does not: a figure that added buckets would miss it.
    const counted = savings(9_000_000, 3_000_000, months);
    expect(counted.saved).toBe(9_000_000 - 4_200_000 - (3_000_000 - 815_900));
    expect(counted.complete).toBe(1);
    expect(counted.rate).toBeCloseTo(counted.saved / (9_000_000 - 4_200_000));
  });

  it("has no rate when nothing came in", () => {
    expect(savings(0, 500_000, months).rate).toBeNull();
  });

  it("counts every month when none is running", () => {
    const finished = trendMonths(
      [bucket("2026-08", 10)],
      [bucket("2026-09", 4)],
      window,
      6,
      TZ,
      null,
    );
    expect(savings(10, 4, finished)).toEqual({ saved: 6, rate: 0.6, complete: 2 });
  });
});

describe("monthComparison", () => {
  const here = monthWindow(SEPTEMBER, TZ);
  const before = monthWindow(shiftMonth(SEPTEMBER, -1, TZ), TZ);

  it("walks both months from their own day one and compares the same number of days", () => {
    const comparison = monthComparison(
      [bucket("2026-09-01", 100), bucket("2026-09-03", 50)],
      [bucket("2026-08-01", 200), bucket("2026-08-02", 100)],
      here,
      before,
      TZ,
      SEPTEMBER,
    );
    expect(comparison.days).toBe(22);
    expect(comparison.spentSoFar).toBe(150);
    expect(comparison.previousSoFar).toBe(300);
    expect(comparison.comparedDays).toBe(22);
    expect(comparison.difference).toBeCloseTo(-0.5);
    // One point per day boundary, starting at zero, so both lines share an x axis of 23 points.
    expect(comparison.current).toHaveLength(23);
    expect(comparison.previous).toHaveLength(23);
    expect(comparison.current.slice(0, 4)).toEqual([0, 100, 100, 150]);
  });

  it("reads both at the last day they share when the previous month is shorter", () => {
    // 31 March against February: the comparison stops at day 28, and the spending after it is not in it.
    const march = new Date("2026-03-31T15:00:00.000Z");
    const february = monthWindow(shiftMonth(march, -1, TZ), TZ);
    const comparison = monthComparison(
      [bucket("2026-03-05", 100), bucket("2026-03-30", 900)],
      [bucket("2026-02-05", 200)],
      monthWindow(march, TZ),
      february,
      TZ,
      march,
    );
    expect(comparison.days).toBe(31);
    expect(comparison.comparedDays).toBe(28);
    expect(comparison.spentSoFar).toBe(1_000);
    expect(comparison.previousSoFar).toBe(200);
    expect(comparison.difference).toBeCloseTo(-0.5);
  });

  it("cannot work out a share of nothing", () => {
    const comparison = monthComparison([bucket("2026-09-01", 10)], [], here, before, TZ, SEPTEMBER);
    expect(comparison.previousSoFar).toBe(0);
    expect(comparison.comparedDays).toBe(22);
    expect(comparison.difference).toBeNull();
  });
});

describe("categoryMix", () => {
  const window = trendWindow(SEPTEMBER, 6, TZ);
  const months = trendMonths(
    [],
    [bucket("2026-08", 1_000), bucket("2026-09", 600)],
    window,
    6,
    TZ,
    "2026-09",
  );

  const withSplits = (key: string, total: number, splits: [string, number][]): StatsBucket => ({
    ...bucket(key, total),
    splits: splits.map(([id, value]) => ({ key: id, total: value, count: 1, avg: value })),
  });

  it("keeps the ranking it was given and leaves the rest of the month in Other", () => {
    const columns = categoryMix(
      months,
      [
        withSplits("2026-08", 1_000, [
          ["food", 400],
          ["bills", 300],
          ["coffee", 100],
        ]),
        withSplits("2026-09", 600, [["food", 500]]),
      ],
      ["food", "bills"],
    );
    expect(columns[0]?.segments).toEqual([
      { key: "food", total: 400 },
      { key: "bills", total: 300 },
      { key: OTHER_KEY, total: 300 },
    ]);
    expect(columns[1]?.segments).toEqual([
      { key: "food", total: 500 },
      { key: OTHER_KEY, total: 100 },
    ]);
    expect(columns.map((column) => column.running)).toEqual([false, true]);
  });

  it("draws no Other when the named categories are the whole month", () => {
    const columns = categoryMix(
      months,
      [withSplits("2026-08", 1_000, [["food", 1_000]])],
      ["food"],
    );
    expect(columns[0]?.segments).toEqual([{ key: "food", total: 1_000 }]);
    expect(columns[1]?.segments).toEqual([]);
    expect(columns[1]?.total).toBe(0);
  });

  it("only names the top five, however many the ranking holds", () => {
    const ranking = ["a", "b", "c", "d", "e", "f"];
    const columns = categoryMix(
      months,
      [
        withSplits(
          "2026-08",
          600,
          ranking.map((key): [string, number] => [key, 100]),
        ),
      ],
      ranking,
    );
    expect(columns[0]?.segments.map((segment) => segment.key)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      OTHER_KEY,
    ]);
  });
});
