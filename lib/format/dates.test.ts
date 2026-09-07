import {
  dateTimeInstant,
  dateTimeParts,
  dayKey,
  dayWindow,
  isSameLocalDay,
  localDateTime,
  localNoon,
  monthWindow,
  shiftMonth,
  toIsoWindow,
  trailingDaysWindow,
} from "./dates";

const BOGOTA = "America/Bogota";

describe("monthWindow", () => {
  it("builds September in Bogotá as UTC instants at local midnight", () => {
    const reference = new Date("2026-09-22T15:00:00Z");
    expect(toIsoWindow(monthWindow(reference, BOGOTA))).toEqual({
      from: "2026-09-01T05:00:00.000Z",
      to: "2026-10-01T05:00:00.000Z",
    });
  });

  it("uses the local month even when UTC already rolled over", () => {
    const reference = new Date("2026-10-01T03:00:00Z");
    expect(toIsoWindow(monthWindow(reference, BOGOTA)).from).toBe("2026-09-01T05:00:00.000Z");
  });

  it("handles a zone with daylight saving", () => {
    expect(toIsoWindow(monthWindow(new Date("2026-03-15T12:00:00Z"), "Europe/Madrid"))).toEqual({
      from: "2026-02-28T23:00:00.000Z",
      to: "2026-03-31T22:00:00.000Z",
    });
  });
});

describe("dayWindow and dayKey", () => {
  it("bounds the local day", () => {
    const instant = new Date("2026-09-22T04:30:00Z");
    expect(dayKey(instant, BOGOTA)).toBe("2026-09-21");
    expect(toIsoWindow(dayWindow(instant, BOGOTA))).toEqual({
      from: "2026-09-21T05:00:00.000Z",
      to: "2026-09-22T05:00:00.000Z",
    });
    expect(isSameLocalDay(instant, new Date("2026-09-21T23:00:00Z"), BOGOTA)).toBe(true);
    expect(isSameLocalDay(instant, new Date("2026-09-22T06:00:00Z"), BOGOTA)).toBe(false);
  });
});

describe("local instants", () => {
  it("sends the chosen calendar day as local noon", () => {
    expect(localNoon("2026-09-22", BOGOTA).toISOString()).toBe("2026-09-22T17:00:00.000Z");
    expect(localDateTime("2026-09-22", "08:42", BOGOTA).toISOString()).toBe(
      "2026-09-22T13:42:00.000Z",
    );
  });

  it("uses the current local time when no time was chosen and round-trips the parts", () => {
    const now = new Date("2026-09-23T04:05:00Z");
    expect(dateTimeInstant({ date: "2026-09-22", time: null }, BOGOTA, now).toISOString()).toBe(
      "2026-09-23T04:05:00.000Z",
    );
    const instant = dateTimeInstant({ date: "2026-09-22", time: "18:10" }, BOGOTA);
    expect(instant.toISOString()).toBe("2026-09-22T23:10:00.000Z");
    expect(dateTimeParts(instant, BOGOTA)).toEqual({ date: "2026-09-22", time: "18:10" });
    expect(dateTimeParts(new Date("2026-09-23T04:05:00Z"), BOGOTA)).toEqual({
      date: "2026-09-22",
      time: "23:05",
    });
  });

  it("builds a trailing window that ends after today's local midnight", () => {
    const window = trailingDaysWindow(new Date("2026-09-22T15:00:00Z"), 90, BOGOTA);
    expect(toIsoWindow(window)).toEqual({
      from: "2026-06-25T05:00:00.000Z",
      to: "2026-09-23T05:00:00.000Z",
    });
  });

  it("shifts months in the user's zone", () => {
    const shifted = shiftMonth(new Date("2026-09-22T15:00:00Z"), -1, BOGOTA);
    expect(dayKey(shifted, BOGOTA)).toBe("2026-08-22");
  });
});
