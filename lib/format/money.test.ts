import {
  decimalSeparators,
  figureIn,
  formatMoney,
  formatPlainNumber,
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
    expect(formatMoney(1284.5, { currency: "JPY", locale: "en-US" })).toBe("¥1,285");
  });

  it("drops the decimals of a zero-decimal currency whatever the device would say", () => {
    expect(nbsp(formatMoney(1284300.5, { currency: "COP", locale: "en-US" }))).toBe("$1,284,301");
    expect(nbsp(formatMoney(1284300.5, { currency: "COP", locale: "es-CO" }))).toBe("$ 1.284.301");
    const parts = moneyParts(1284300.5, { currency: "COP", locale: "en-US" });
    expect(parts.integer).toBe("1,284,301");
    expect(parts.fraction).toBe("");
    expect(parts.decimal).toBe("");
  });

  it("gives a zero-decimal currency two decimals never, and a three-decimal one only two", () => {
    expect(nbsp(formatMoney(10000, { currency: "HUF", locale: "en-US" }))).toBe("Ft 10,000");
    expect(nbsp(formatMoney(12.345, { currency: "KWD", locale: "en-US" }))).toBe("KWD 12.35");
  });

  it("keeps the sign outside the parts of a negative zero-decimal amount", () => {
    const parts = moneyParts(-1000.5, { currency: "COP", locale: "en-US" });
    expect(parts.integer).toBe("1,001");
    expect(parts.fraction).toBe("");
    expect(parts.formatted).toBe("-$1,001");
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
    expect(parseDecimal("1.284.300,50", "es-CO", 2)).toBe(1284300.5);
    expect(parseDecimal("12,5", "es-CO", 2)).toBe(12.5);
  });

  it("parses an English amount with comma groups and decimal point", () => {
    expect(parseDecimal("1,284,300.50", "en-US", 2)).toBe(1284300.5);
    expect(parseDecimal(" 42 ", "en-US", 2)).toBe(42);
  });

  it("rejects garbage and empty input", () => {
    expect(parseDecimal("", "en-US", 2)).toBeNull();
    expect(parseDecimal("12.34.56", "en-US", 2)).toBeNull();
    expect(parseDecimal("abc", "es-CO", 2)).toBeNull();
    expect(parseDecimal("1.2,3.4", "en-US", 2)).toBeNull();
    expect(parseDecimal(",", "es-CO", 2)).toBeNull();
  });

  it("takes the keyboard's other separator as the decimal point unless three digits follow it", () => {
    expect(parseDecimal("12.50", "es-CO", 2)).toBe(12.5);
    expect(parseDecimal("12.", "es-CO", 2)).toBe(12);
    expect(parseDecimal("12,5", "en-US", 2)).toBe(12.5);
    expect(parseDecimal("1.250", "es-CO", 2)).toBe(1250);
    expect(parseDecimal("1,250", "en-US", 2)).toBe(1250);
    expect(parseDecimal("1.250.000", "es-CO", 2)).toBe(1250000);
  });

  it("reads a figure written the other way round when both separators are there", () => {
    expect(parseDecimal("1,284,300.50", "es-CO", 2)).toBe(1284300.5);
    expect(parseDecimal("1.284.300,50", "en-US", 2)).toBe(1284300.5);
    expect(parseDecimal("12,34,567.8", "en-IN", 2)).toBe(1234567.8);
  });

  it("never reads a decimal the currency cannot have", () => {
    expect(parseDecimal("12,500", "es-CO", 0)).toBe(12500);
    expect(parseDecimal("1.250", "en-US", 0)).toBe(1250);
    expect(parseDecimal("12,345", "es-CO", 2)).toBe(12345);
    expect(parseDecimal("12.5", "en-US", 0)).toBeNull();
    expect(parseDecimal("1,284,300.50", "en-US", 0)).toBeNull();
    expect(parseDecimal("0.001", "es-CO", 2)).toBeNull();
  });
});

describe("figureIn", () => {
  it("keeps the digits, separators and sign of a copied amount", () => {
    expect(figureIn("$12.50")).toBe("12.50");
    expect(figureIn("COP 12.500")).toBe(" 12.500");
    expect(figureIn("-1 234,50 €")).toBe("-1 234,50 ");
  });
});

describe("formatPlainNumber", () => {
  it("writes the locale's decimal and no grouping", () => {
    expect(formatPlainNumber(1234.5, "es-CO")).toBe("1234,5");
    expect(formatPlainNumber(33.33, "en-US")).toBe("33.33");
    expect(formatPlainNumber(12.345, "en-US", 2)).toBe("12.35");
  });
});

describe("roundToCurrency", () => {
  it("rounds to the currency's minor unit", () => {
    expect(roundToCurrency(1000.5, "COP")).toBe(1001);
    expect(roundToCurrency(10.005, "USD")).toBe(10.01);
  });
});
