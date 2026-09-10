import { dayWindow, widenedBound, withinDays } from "./days";

const BOGOTA = "America/Bogota";
// August in Bogota: [Aug 1 00:00, Sep 1 00:00) local.
const AUGUST = dayWindow("2026-08-01T05:00:00.000Z", "2026-09-01T05:00:00.000Z", BOGOTA);

const row = (date: string, dayKey: string | null) => ({ date, dayKey });

describe("dayWindow", () => {
  it("names the first and the last local day the window covers", () => {
    expect(AUGUST.fromDay).toBe("2026-08-01");
    expect(AUGUST.toDay).toBe("2026-08-31");
  });

  it("covers the whole day of a bound that is not local midnight", () => {
    const window = dayWindow("2026-08-03T18:00:00.000Z", "2026-08-04T18:00:00.000Z", BOGOTA);
    expect(window.fromDay).toBe("2026-08-03");
    expect(window.toDay).toBe("2026-08-04");
  });

  it("leaves an absent bound open", () => {
    const window = dayWindow(undefined, "2026-09-01T05:00:00.000Z", BOGOTA);
    expect(window.fromDay).toBeUndefined();
    expect(window.from).toBe(-Infinity);
  });
});

describe("withinDays", () => {
  it("keeps a row by the day frozen on it, whatever its instant says", () => {
    // 11pm on Aug 31 in Bogota: the instant is September's, the accounting day is August's.
    expect(withinDays(row("2026-09-01T04:00:00.000Z", "2026-08-31"), AUGUST)).toBe(true);
    // And the reverse: 7pm on Jul 31 in Bogota is Aug 1 in UTC.
    expect(withinDays(row("2026-08-01T00:00:00.000Z", "2026-07-31"), AUGUST)).toBe(false);
  });

  it("answers a row written before the day was stored by its instant (T-14, H-28)", () => {
    // 11pm on Aug 31 in Bogota. Read from the zone it was written in, both rules agree: a row
    // without a day is not lost, which is why no backfill has to run before this ships.
    const lateNight = "2026-09-01T04:00:00.000Z";
    expect(withinDays(row(lateNight, null), AUGUST)).toBe(true);
    expect(withinDays(row(lateNight, "2026-08-31"), AUGUST)).toBe(true);

    // Read from another zone, only the frozen day keeps it in August. That is exactly what a row
    // without one still loses, and what the backfill buys it.
    const augustInMadrid = dayWindow(
      "2026-07-31T22:00:00.000Z",
      "2026-08-31T22:00:00.000Z",
      "Europe/Madrid",
    );
    expect(withinDays(row(lateNight, null), augustInMadrid)).toBe(false);
    expect(withinDays(row(lateNight, "2026-08-31"), augustInMadrid)).toBe(true);

    // A row in the middle of its day reads the same under either rule, in any zone.
    expect(withinDays(row("2026-08-15T17:00:00.000Z", null), AUGUST)).toBe(true);
    expect(withinDays(row("2026-08-15T17:00:00.000Z", null), augustInMadrid)).toBe(true);
  });

  it("takes everything when the window has no bounds", () => {
    const open = dayWindow(undefined, undefined, BOGOTA);
    expect(withinDays(row("2020-01-01T00:00:00.000Z", "2019-12-31"), open)).toBe(true);
    expect(withinDays(row("2020-01-01T00:00:00.000Z", null), open)).toBe(true);
  });
});

describe("widenedBound", () => {
  it("moves a bound two days out so an index range cannot miss an edge row", () => {
    expect(widenedBound("2026-08-01T05:00:00.000Z", -1)).toBe("2026-07-30T05:00:00.000Z");
    expect(widenedBound("2026-09-01T05:00:00.000Z", 1)).toBe("2026-09-03T05:00:00.000Z");
  });

  it("leaves an absent bound and an unparseable one alone", () => {
    expect(widenedBound(undefined, -1)).toBeUndefined();
    expect(widenedBound("not a date", -1)).toBe("not a date");
  });
});
