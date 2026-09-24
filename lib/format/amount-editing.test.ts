import {
  acceptDecimalKey,
  caretAfterUnits,
  countUnits,
  formatEditableAmount,
  padLeadingDecimal,
} from "./amount-editing";

describe("formatEditableAmount", () => {
  it("groups thousands live and keeps the clean number", () => {
    expect(formatEditableAmount("12500", "en-US", 0)).toEqual({ text: "12,500", value: 12500 });
    expect(formatEditableAmount("1234567", "es-CO", 0)).toEqual({
      text: "1.234.567",
      value: 1234567,
    });
    expect(formatEditableAmount("", "en-US", 2)).toEqual({ text: "", value: null });
  });

  it("stops at the integer digits the shared ceiling allows", () => {
    expect(formatEditableAmount("1".repeat(20), "en-US", 0).text).toBe("11,111,111,111,111");
  });

  it("strips letters, grouping characters and leading zeros", () => {
    expect(formatEditableAmount("12abc", "en-US", 0).text).toBe("12");
    expect(formatEditableAmount("1,234,5", "en-US", 0)).toEqual({ text: "12,345", value: 12345 });
    expect(formatEditableAmount("007", "en-US", 0)).toEqual({ text: "7", value: 7 });
    expect(formatEditableAmount("1.5", "en-US", 0)).toEqual({ text: "15", value: 15 });
  });

  it("keeps a trailing decimal separator while typing and caps the fraction", () => {
    expect(formatEditableAmount("1284,", "es-CO", 2)).toEqual({ text: "1.284,", value: 1284 });
    expect(formatEditableAmount("1284,509", "es-CO", 2)).toEqual({
      text: "1.284,50",
      value: 1284.5,
    });
    expect(formatEditableAmount("1234.5", "en-US", 2)).toEqual({ text: "1,234.5", value: 1234.5 });
    expect(formatEditableAmount(".5", "en-US", 2)).toEqual({ text: "0.5", value: 0.5 });
  });
});

describe("caret bookkeeping", () => {
  it("counts digits and the first decimal separator before the caret", () => {
    expect(countUnits("1,2|", 3, ".")).toBe(2);
    expect(countUnits("1.5.", 4, ".")).toBe(3);
  });

  it("places the caret after the same units in the formatted text", () => {
    expect(caretAfterUnits("12,345", 2, ".")).toBe(2);
    expect(caretAfterUnits("12,345", 3, ".")).toBe(4);
    expect(caretAfterUnits("1,234.5", 5, ".")).toBe(6);
    expect(caretAfterUnits("12,345", 0, ".")).toBe(0);
  });
});

describe("acceptDecimalKey", () => {
  const typed = (previous: string, key: string, loose = false) => ({
    previous,
    raw: previous + key,
    caret: previous.length + key.length,
    loose,
  });

  it("takes the other separator as the decimal point the locale uses", () => {
    expect(acceptDecimalKey(typed("12", "."), ",", 2)).toEqual({
      raw: "12,",
      caret: 3,
      loose: true,
    });
    expect(acceptDecimalKey(typed("1.284", "."), ",", 2)).toEqual({
      raw: "1.284,",
      caret: 6,
      loose: true,
    });
    expect(acceptDecimalKey(typed("12", ","), ".", 2)).toEqual({
      raw: "12.",
      caret: 3,
      loose: true,
    });
  });

  it("gives it back as a thousands group once a third digit follows it", () => {
    expect(acceptDecimalKey(typed("1.00", "0", true), ".", 2)).toEqual({
      raw: "1000",
      caret: 4,
      loose: false,
    });
    expect(acceptDecimalKey(typed("1.00", "0"), ".", 2)).toEqual({
      raw: "1.000",
      caret: 5,
      loose: false,
    });
  });

  it("leaves the key alone under a zero-decimal currency or once there is a decimal", () => {
    expect(acceptDecimalKey(typed("12", "."), ",", 0)).toEqual({
      raw: "12.",
      caret: 3,
      loose: false,
    });
    expect(acceptDecimalKey(typed("12,5", "."), ",", 2)).toEqual({
      raw: "12,5.",
      caret: 5,
      loose: false,
    });
  });

  it("only rewrites a key that was typed, not a separator already in the text", () => {
    expect(
      acceptDecimalKey({ previous: "1.234", raw: "1.23", caret: 4, loose: false }, ",", 2),
    ).toEqual({ raw: "1.23", caret: 4, loose: false });
  });

  it("takes a separator typed over a selection, but not a deletion that leaves one behind", () => {
    expect(
      acceptDecimalKey({ previous: "1.234", raw: "1.", caret: 2, loose: false }, ",", 2),
    ).toEqual({ raw: "1.", caret: 2, loose: false });
    expect(
      acceptDecimalKey({ previous: "12.345", raw: "12,", caret: 3, loose: false }, ".", 2),
    ).toEqual({ raw: "12.", caret: 3, loose: true });
    expect(
      acceptDecimalKey({ previous: "1.234", raw: "1.34", caret: 2, loose: false }, ",", 2),
    ).toEqual({ raw: "1.34", caret: 2, loose: false });
  });

  it("keeps a decimal as one when a digit lands in the middle of its fraction", () => {
    expect(
      acceptDecimalKey({ previous: "12,55", raw: "12,055", caret: 4, loose: true }, ",", 2),
    ).toEqual({ raw: "12,055", caret: 4, loose: false });
  });

  it("forgets where the decimal came from once it is deleted", () => {
    expect(acceptDecimalKey({ previous: "1.5", raw: "15", caret: 1, loose: true }, ".", 2)).toEqual(
      {
        raw: "15",
        caret: 1,
        loose: false,
      },
    );
  });
});

describe("padLeadingDecimal", () => {
  it("puts the zero a leading decimal is shown with before the caret", () => {
    expect(padLeadingDecimal(",", 1, ",", 2)).toEqual({ raw: "0,", caret: 2 });
    expect(padLeadingDecimal("12,5", 4, ",", 2)).toEqual({ raw: "12,5", caret: 4 });
    expect(padLeadingDecimal(".", 1, ".", 0)).toEqual({ raw: ".", caret: 1 });
  });
});
