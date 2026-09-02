import {
  dayKey,
  dayWindow,
  isSameLocalDay,
  localDateTime,
  localNoon,
  monthWindow,
  shiftMonth,
  toIsoWindow,
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

  it("shifts months in the user's zone", () => {
    const shifted = shiftMonth(new Date("2026-09-22T15:00:00Z"), -1, BOGOTA);
    expect(dayKey(shifted, BOGOTA)).toBe("2026-08-22");
  });
});
