import { monthReference, parseMonthKey, shiftMonthKey } from "./reference";

describe("month reference", () => {
  it("points at noon on the 15th in the user's zone so any server zone resolves the same month", () => {
    expect(monthReference("2026-09", "America/Bogota").iso).toBe("2026-09-15T17:00:00.000Z");
    expect(monthReference("2026-09", "America/Los_Angeles").iso).toBe("2026-09-15T19:00:00.000Z");
    expect(monthReference("2026-09", "Asia/Tokyo").iso).toBe("2026-09-15T03:00:00.000Z");
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
