import {
  currencyForRegion,
  currencyFractionDigits,
  currencyName,
  isKnownCurrency,
  regionOf,
} from "./currency";
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

  it("knows the minor unit itself instead of asking the device", () => {
    expect(currencyFractionDigits("COP")).toBe(0);
    expect(currencyFractionDigits("CLP")).toBe(0);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("HUF")).toBe(0);
    expect(currencyFractionDigits("IDR")).toBe(0);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("EUR")).toBe(2);
    expect(currencyFractionDigits("cop")).toBe(0);
    expect(currencyFractionDigits("XXX_NOPE")).toBe(2);
  });

  it("caps the three-decimal currencies at two, which is what the server stores", () => {
    for (const code of ["BHD", "JOD", "KWD", "LYD", "OMR", "TND"]) {
      expect(
        new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions()
          .maximumFractionDigits,
      ).toBe(3);
      expect(currencyFractionDigits(code)).toBe(2);
    }
  });

  it("does not follow this device's Intl, which is the whole point", () => {
    const device = (code: string) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits;
    const disagrees = ["KWD", "BHD", "OMR"].filter(
      (code) => device(code) !== currencyFractionDigits(code),
    );
    expect(disagrees).toEqual(["KWD", "BHD", "OMR"]);
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
