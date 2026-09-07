import { monthReference, overlapsMonth, parseMonthKey, shiftMonthKey } from "./reference";

describe("month reference", () => {
  const now = new Date("2026-09-22T15:00:00.000Z");

  it("uses now for the current month and noon on the 15th for a past one", () => {
    expect(monthReference("2026-09", "America/Bogota", now).iso).toBe("2026-09-22T15:00:00.000Z");
    expect(monthReference("2026-08", "America/Bogota", now).iso).toBe("2026-08-15T17:00:00.000Z");
    expect(monthReference("2026-08", "America/Los_Angeles", now).iso).toBe(
      "2026-08-15T19:00:00.000Z",
    );
    expect(monthReference("2026-08", "Asia/Tokyo", now).iso).toBe("2026-08-15T03:00:00.000Z");
  });

  it("keeps a custom budget only in the months its window touches", () => {
    const september = {
      from: new Date("2026-09-01T05:00:00.000Z"),
      to: new Date("2026-10-01T05:00:00.000Z"),
    };
    const twoDays = {
      periodType: "CUSTOM" as const,
      periodFrom: "2026-09-02T05:00:00.000Z",
      periodTo: "2026-09-04T05:00:00.000Z",
    };
    expect(overlapsMonth(twoDays, september)).toBe(true);
    expect(
      overlapsMonth(twoDays, {
        from: new Date("2026-08-01T05:00:00.000Z"),
        to: new Date("2026-09-01T05:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      overlapsMonth(
        {
          ...twoDays,
          periodFrom: "2026-08-20T05:00:00.000Z",
          periodTo: "2026-09-02T05:00:00.000Z",
        },
        september,
      ),
    ).toBe(true);
    expect(overlapsMonth({ ...twoDays, periodType: "MONTHLY" }, september)).toBe(true);
  });

  it("shifts months and falls back to the current month for bad keys", () => {
    expect(shiftMonthKey("2026-01", -1, "America/Bogota")).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1, "America/Bogota")).toBe("2027-01");
    const now = new Date("2026-09-02T03:00:00.000Z");
    expect(parseMonthKey("nope", now, "America/Bogota")).toBe("2026-09");
    expect(parseMonthKey("2026-08", now, "America/Bogota")).toBe("2026-08");
    expect(parseMonthKey(null, now, "America/Los_Angeles")).toBe("2026-09");
  });
});
