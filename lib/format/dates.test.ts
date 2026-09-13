import { inDeviceZone } from "@/lib/testing/zones";

import {
  dateTimeInstant,
  dateTimeParts,
  dayKey,
  daysWindow,
  dayWindow,
  isSameLocalDay,
  localDateTime,
  localNoon,
  monthWindow,
  shiftDayKey,
  shiftDayKeyMonths,
  shiftMonth,
  toIsoWindow,
  trailingDaysWindow,
  weekWindow,
  yearWindow,
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

// Zones whose clocks move at or across midnight: there a device-local midnight can be missing
// (Havana, Santiago) or an hour at the end of the day can be (Nuuk jumps 22:59 to 00:00).
const DEVICE_ZONES = ["UTC", "America/Nuuk", "America/Havana", "Australia/Lord_Howe"];
const USER_ZONES = ["Europe/Madrid", "America/Havana", "America/Santiago", "Pacific/Chatham"];
const HOURS = [0, 1, 4, 23];

const WINDOWS: [string, (reference: Date, timeZone: string) => unknown][] = [
  ["monthWindow", (reference, tz) => toIsoWindow(monthWindow(reference, tz))],
  ["weekWindow", (reference, tz) => toIsoWindow(weekWindow(reference, tz))],
  ["yearWindow", (reference, tz) => toIsoWindow(yearWindow(reference, tz))],
  ["dayWindow", (reference, tz) => toIsoWindow(dayWindow(reference, tz))],
  ["trailingDaysWindow", (reference, tz) => toIsoWindow(trailingDaysWindow(reference, 30, tz))],
  ["shiftMonth", (reference, tz) => shiftMonth(reference, -1, tz).toISOString()],
  ["dayKey", (reference, tz) => dayKey(reference, tz)],
  ["dateTimeParts", (reference, tz) => dateTimeParts(reference, tz)],
  [
    "daysWindow",
    (reference, tz) => toIsoWindow(daysWindow(dayKey(reference, tz), dayKey(reference, tz), tz)),
  ],
];

describe("in every device zone", () => {
  it.each(WINDOWS)("%s answers the same wherever the device is", (name, window) => {
    for (let day = 0; day < 365; day += 2)
      for (const hour of HOURS) {
        const reference = new Date(Date.UTC(2026, 0, 1 + day, hour, 30));
        for (const user of USER_ZONES) {
          const expected = inDeviceZone("UTC", () => window(reference, user));
          for (const device of DEVICE_ZONES)
            expect(
              inDeviceZone(device, () => window(reference, user)),
              `${name} at ${reference.toISOString()} for ${user}, device in ${device}`,
            ).toEqual(expected);
        }
      }
  });
});

// The sweep above only proves the answer does not depend on the device. This one proves the answer.
describe("against Intl, which is the only thing that knows a zone", () => {
  const wallClock = (instant: Date, timeZone: string) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      dateStyle: "short",
      timeStyle: "medium",
    }).format(instant);

  it.each([
    ["America/Bogota", "2026-09-22T04:30:00.000Z", "2026-09-21"],
    ["Pacific/Kiritimati", "2026-09-11T12:00:00.000Z", "2026-09-12"],
    ["Europe/Madrid", "2026-03-28T22:30:00.000Z", "2026-03-28"],
    ["America/Nuuk", "2026-03-28T21:30:00.000Z", "2026-03-28"],
  ])("bounds the local day of %s at %s", (zone, at, day) => {
    const instant = new Date(at);
    expect(dayKey(instant, zone)).toBe(day);
    const window = dayWindow(instant, zone);
    expect(wallClock(window.from, zone)).toBe(`${day} 00:00:00`);
    expect(instant >= window.from && instant < window.to).toBe(true);
  });

  it("reads an hour its own zone repeated as the first of the two", () => {
    const repeated: [string, string, string, string][] = [
      ["Europe/Madrid", "2026-10-25", "02:30", "2026-10-25T00:30:00.000Z"],
      ["Asia/Amman", "2021-10-29", "00:00", "2021-10-28T21:00:00.000Z"],
      ["America/Havana", "2026-11-01", "00:30", "2026-11-01T04:30:00.000Z"],
    ];
    for (const [zone, day, time, at] of repeated) {
      const instant = localDateTime(day, time, zone);
      expect(instant.toISOString(), `${zone} ${day} ${time}`).toBe(at);
      const window = daysWindow(dayKey(instant, zone), dayKey(instant, zone), zone);
      expect(dayKey(instant, zone)).toBe(day);
      expect(instant >= window.from && instant < window.to, `${zone} ${day}`).toBe(true);
    }
  });

  it("reads an hour the user's own zone skipped as the first one it has", () => {
    expect(localDateTime("2026-09-06", "00:30", "America/Santiago").toISOString()).toBe(
      "2026-09-06T04:30:00.000Z",
    );
    expect(
      wallClock(localDateTime("2026-09-06", "00:30", "America/Santiago"), "America/Santiago"),
    ).toBe("2026-09-06 01:30:00");
  });

  it("leaves no gap and no overlap between one local day and the next", () => {
    for (const zone of ["America/Santiago", "America/Havana", "America/Nuuk", "Pacific/Chatham"])
      for (const day of ["2026-09-05", "2026-10-31", "2026-03-28"])
        expect(daysWindow(day, day, zone).to, `${zone} ${day}`).toEqual(
          daysWindow(shiftDayKey(day, 1), shiftDayKey(day, 1), zone).from,
        );
  });
});

describe("shiftDayKeyMonths", () => {
  it("keeps the day of the month and clamps it where the month is shorter", () => {
    expect(shiftDayKeyMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDayKeyMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(shiftDayKeyMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftDayKeyMonths("2026-01-31", 13)).toBe("2027-02-28");
    expect(shiftDayKeyMonths("2026-09-06", 0)).toBe("2026-09-06");
  });
});

describe("daysWindow", () => {
  it("spans whole days in the user's zone whatever zone the device is in", () => {
    for (const zone of ["UTC", "America/New_York", "Australia/Lord_Howe"]) {
      expect(
        inDeviceZone(zone, () => toIsoWindow(daysWindow("2025-11-02", "2025-11-02", BOGOTA))),
        zone,
      ).toEqual({ from: "2025-11-02T05:00:00.000Z", to: "2025-11-03T05:00:00.000Z" });
    }
  });

  it("follows the user's own daylight change", () => {
    expect(toIsoWindow(daysWindow("2026-03-28", "2026-03-29", "Europe/Madrid"))).toEqual({
      from: "2026-03-27T23:00:00.000Z",
      to: "2026-03-29T22:00:00.000Z",
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
