import { currencyForRegion, currencyName, isKnownCurrency, regionOf } from "./currency";
import { isKnownTimeZone, timeZoneCity, timeZoneOffsetLabel } from "./timezone";

describe("currency detection", () => {
  it("maps the device region to a currency and falls back to COP", () => {
    expect(regionOf("es-CO")).toBe("CO");
    expect(regionOf("es")).toBe("ES");
    expect(currencyForRegion("CO")).toBe("COP");
    expect(currencyForRegion("US")).toBe("USD");
    expect(currencyForRegion("ZZ")).toBe("COP");
    expect(currencyForRegion(undefined)).toBe("COP");
  });

  it("names currencies in the user's language", () => {
    expect(currencyName("COP", "en-US")).toBe("Colombian Peso");
    expect(currencyName("COP", "es-CO")).toMatch(/peso colombiano/i);
    expect(isKnownCurrency("COP")).toBe(true);
    expect(isKnownCurrency("XXX_NOPE")).toBe(false);
  });
});

describe("time zones", () => {
  it("labels offsets and cities", () => {
    expect(timeZoneOffsetLabel("America/Bogota", "en-US", new Date("2026-09-22T12:00:00Z"))).toBe(
      "GMT-5",
    );
    expect(timeZoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(isKnownTimeZone("America/Bogota")).toBe(true);
    expect(isKnownTimeZone("Mars/Olympus")).toBe(false);
  });
});
