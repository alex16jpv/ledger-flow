import { budgetProgress } from "./progress";

const base = {
  periodFrom: "2026-09-01T05:00:00.000Z",
  periodTo: "2026-10-01T05:00:00.000Z",
  periodType: "MONTHLY" as const,
  expired: false,
};
const now = new Date("2026-09-22T15:00:00.000Z");

describe("budgetProgress", () => {
  it("reports what is left, the elapsed share, the days left and the daily pace", () => {
    const progress = budgetProgress({ ...base, spent: 1_284_300, amount: 2_000_000 }, now);
    expect(progress.remaining).toBe(715_700);
    expect(progress.daysLeft).toBe(9);
    expect(progress.elapsed).toBeCloseTo(21.42 / 30, 2);
    expect(progress.perDay).toBeCloseTo(715_700 / 9);
    expect(progress.status).toBe("ok");
  });

  it("flags a fast pace from 80 %, overspending above 100 % and an untouched budget", () => {
    expect(budgetProgress({ ...base, spent: 185_500, amount: 200_000 }, now).status).toBe("fast");
    const over = budgetProgress({ ...base, spent: 356_000, amount: 300_000 }, now);
    expect(over.status).toBe("over");
    expect(over.remaining).toBe(-56_000);
    expect(over.perDay).toBeNull();
    expect(budgetProgress({ ...base, spent: 0, amount: 350_000 }, now).status).toBe("untouched");
  });

  it("marks a period that already closed as ended, with no days left", () => {
    const past = budgetProgress(
      { ...base, spent: 100, amount: 500 },
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(past.status).toBe("ended");
    expect(past.daysLeft).toBe(0);
    expect(past.elapsed).toBe(1);
  });
});
