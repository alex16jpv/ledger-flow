import {
  calendarLeading,
  DEFAULT_WEEK_START,
  isoWeekday,
  weekColumn,
  weekColumns,
  weekStartFor,
} from "./days";

describe("days", () => {
  it("counts Sunday as 7, the way Intl does and Date does not", () => {
    expect(isoWeekday("2026-09-07")).toBe(1);
    expect(isoWeekday("2026-09-13")).toBe(7);
  });

  it("reads the first day of the week from the locale", () => {
    expect(weekStartFor("en-US")).toBe(7);
    expect(weekStartFor("es-ES")).toBe(1);
  });

  it("falls back to Monday when the engine cannot answer", () => {
    expect(weekStartFor("not a locale")).toBe(DEFAULT_WEEK_START);
  });

  it("places a day in the column its week start gives it", () => {
    expect(weekColumn("2026-09-13", 1)).toBe(6);
    expect(weekColumn("2026-09-13", 7)).toBe(0);
    expect(weekColumn("2026-09-01", 1)).toBe(1);
  });

  it("lists the seven columns starting where the locale starts", () => {
    expect(weekColumns(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekColumns(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it("pads the first week by the column its first day falls in", () => {
    expect(calendarLeading("2026-09-01", 1)).toBe(1);
    expect(calendarLeading("2026-09-01", 7)).toBe(2);
    expect(calendarLeading(undefined, 1)).toBe(0);
  });
});
