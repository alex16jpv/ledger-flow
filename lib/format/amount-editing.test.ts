import { caretAfterUnits, countUnits, formatEditableAmount } from "./amount-editing";

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
