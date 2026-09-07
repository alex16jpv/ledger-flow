import { daySeries, shares, transactionCount } from "./model";

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
    expect(series.bars[8]).toMatchObject({ key: "2026-09-09", value: 214_000 });
    expect(series.bars[9]?.today).toBe(true);
    expect(series.highest?.key).toBe("2026-09-09");
    expect(series.noSpendDays).toBe(8);
    expect(series.dailyAverage).toBeCloseTo(226_500 / 10);
  });
});
