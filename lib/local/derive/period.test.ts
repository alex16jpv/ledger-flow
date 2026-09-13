import { inDeviceZone } from "@/lib/testing/zones";
import type { SyncBudget } from "@/types/api";

import { type PeriodDefinition, resolvePeriod } from "./period";

const budget = (periodType: SyncBudget["periodType"]): PeriodDefinition => ({
  periodType,
  periodStartDate: null,
  periodEndDate: null,
});

const TYPES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

describe("resolvePeriod", () => {
  it("resolves the period in the user's zone, never in the device's", () => {
    for (const type of TYPES)
      for (let day = 0; day < 365; day += 2)
        for (const hour of [0, 12, 23]) {
          const reference = new Date(Date.UTC(2026, 0, 1 + day, hour, 30));
          for (const user of ["Europe/Madrid", "America/Havana"]) {
            const expected = inDeviceZone("UTC", () =>
              resolvePeriod(budget(type), reference, user),
            );
            for (const device of ["America/Nuuk", "America/Havana", "Australia/Lord_Howe"])
              expect(
                inDeviceZone(device, () => resolvePeriod(budget(type), reference, user)),
                `${type} at ${reference.toISOString()} for ${user}, device in ${device}`,
              ).toEqual(expected);
          }
        }
  });

  it("bounds a month at the user's own midnight and keys it by its month", () => {
    const period = resolvePeriod(
      budget("MONTHLY"),
      new Date("2026-09-22T15:00:00Z"),
      "America/Bogota",
    );
    expect(period.key).toBe("2026-09");
    expect(period.from.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(period.to.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("keeps a custom period exactly as it was stored", () => {
    const period = resolvePeriod(
      {
        periodType: "CUSTOM",
        periodStartDate: "2026-09-01T05:00:00.000Z",
        periodEndDate: "2026-09-16T05:00:00.000Z",
      },
      new Date("2026-09-22T15:00:00Z"),
      "America/Bogota",
    );
    expect(period.from.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(period.to.toISOString()).toBe("2026-09-16T05:00:00.000Z");
  });
});
