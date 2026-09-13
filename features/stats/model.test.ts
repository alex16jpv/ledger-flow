import type { DaySlot } from "@/lib/charts/days";

import { daySeries, shares, transactionCount, weekdayAverages } from "./model";

const buckets = [
  { key: "food", total: 412_000, count: 24, avg: 17_166 },
  { key: "uncategorized", total: 47_900, count: 3, avg: 15_966 },
  { key: "lifestyle", total: 356_000, count: 11, avg: 32_363 },
];

describe("stats model", () => {
  it("orders shares by total and divides by the API total", () => {
    const result = shares(buckets, 815_900);
    expect(result.map((share) => share.key)).toEqual(["food", "lifestyle", "uncategorized"]);
    expect(result[0]?.share).toBeCloseTo(0.505, 3);
    expect(transactionCount(buckets)).toBe(38);
  });

  it("fills every day of the window, marks today and derives the day stats", () => {
    const window = {
      from: new Date("2026-09-01T05:00:00.000Z"),
      to: new Date("2026-10-01T05:00:00.000Z"),
    };
    const series = daySeries(
      [
        { key: "2026-09-09", total: 214_000, count: 3, avg: 71_333 },
        { key: "2026-09-02", total: 12_500, count: 1, avg: 12_500 },
      ],
      window,
      "America/Bogota",
      new Date("2026-09-10T15:00:00.000Z"),
      226_500,
    );
    expect(series.bars).toHaveLength(30);
    expect(series.bars[8]).toEqual({
      key: "2026-09-09",
      value: 214_000,
      count: 3,
      today: false,
      future: false,
    });
    expect(series.bars[9]?.today).toBe(true);
    expect(series.bars[9]?.future).toBe(false);
    expect(series.bars[10]?.future).toBe(true);
    expect(series.bars.filter((bar) => bar.future)).toHaveLength(20);
    expect(series.highest?.key).toBe("2026-09-09");
    expect(series.noSpendDays).toBe(8);
    expect(series.dailyAverage).toBeCloseTo(226_500 / 10);
  });

  it("averages each weekday over the days of it that have happened", () => {
    // 2026-09-01 is a Tuesday, so Wednesdays are the 2nd and the 9th and Thursdays only the 3rd.
    const bars: DaySlot[] = [
      { key: "2026-09-01", value: 0 },
      { key: "2026-09-02", value: 10.01 },
      { key: "2026-09-03", value: 40_000 },
      { key: "2026-09-04", value: 0 },
      { key: "2026-09-05", value: 0 },
      { key: "2026-09-06", value: 0 },
      { key: "2026-09-07", value: 0 },
      { key: "2026-09-08", value: 0 },
      { key: "2026-09-09", value: 0.01 },
      { key: "2026-09-10", value: 999, future: true },
    ];
    const week = weekdayAverages(bars);
    expect(week).toHaveLength(7);
    const wednesday = week.find((entry) => entry.weekday === 3);
    // Added in minor units: 10.01 + 0.01 over two days is 5.01, not 5.010000000000001.
    expect(wednesday).toEqual({ weekday: 3, average: 5.01, days: 2 });
    const thursday = week.find((entry) => entry.weekday === 4);
    expect(thursday).toEqual({ weekday: 4, average: 40_000, days: 1 });
  });

  it("leaves a weekday no day has reached at zero instead of dividing by none", () => {
    const week = weekdayAverages([{ key: "2026-09-01", value: 100 }]);
    expect(week.find((entry) => entry.weekday === 2)).toEqual({
      weekday: 2,
      average: 100,
      days: 1,
    });
    expect(week.find((entry) => entry.weekday === 5)).toEqual({ weekday: 5, average: 0, days: 0 });
  });
});
