import {
  decimalSeparators,
  formatMoney,
  fractionDigits,
  moneyParts,
  parseDecimal,
  roundToCurrency,
} from "./money";

const nbsp = (value: string) => value.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  it("formats COP without decimals in both regions", () => {
    expect(nbsp(formatMoney(1284300, { currency: "COP", locale: "en-US" }))).toBe("$1,284,300");
    expect(nbsp(formatMoney(1284300, { currency: "COP", locale: "es-CO" }))).toBe("$ 1.284.300");
  });

  it("keeps two decimals for USD and none for JPY", () => {
    expect(formatMoney(12.5, { currency: "USD", locale: "en-US" })).toBe("$12.50");
    expect(fractionDigits("USD")).toBe(2);
    expect(fractionDigits("COP")).toBe(0);
    expect(fractionDigits("JPY")).toBe(0);
  });
});

describe("moneyParts", () => {
  it("splits symbol, integer and fraction", () => {
    const parts = moneyParts(-1284.5, { currency: "USD", locale: "en-US" });
    expect(parts.symbol).toBe("$");
    expect(parts.integer).toBe("1,284");
    expect(parts.decimal).toBe(".");
    expect(parts.fraction).toBe("50");
    expect(parts.formatted).toBe("-$1,284.50");
  });
});

describe("parseDecimal", () => {
  it("parses a Spanish amount with dot groups and decimal comma", () => {
    expect(decimalSeparators("es-CO")).toEqual({ group: ".", decimal: "," });
    expect(parseDecimal("1.284.300,50", "es-CO")).toBe(1284300.5);
    expect(parseDecimal("12,5", "es-CO")).toBe(12.5);
  });

  it("parses an English amount with comma groups and decimal point", () => {
    expect(parseDecimal("1,284,300.50", "en-US")).toBe(1284300.5);
    expect(parseDecimal(" 42 ", "en-US")).toBe(42);
  });

  it("rejects garbage and empty input", () => {
    expect(parseDecimal("", "en-US")).toBeNull();
    expect(parseDecimal("12.34.56", "en-US")).toBeNull();
    expect(parseDecimal("abc", "es-CO")).toBeNull();
  });
});

describe("roundToCurrency", () => {
  it("rounds to the currency's minor unit", () => {
    expect(roundToCurrency(1000.5, "COP")).toBe(1001);
    expect(roundToCurrency(10.005, "USD")).toBe(10.01);
  });
});
