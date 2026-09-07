import { formatLocaleFor } from "./format-locale";

describe("formatLocaleFor", () => {
  it("uses the default region per language", () => {
    expect(formatLocaleFor("en")).toBe("en-US");
    expect(formatLocaleFor("es")).toBe("es-CO");
    expect(formatLocaleFor("es", null)).toBe("es-CO");
  });

  it("keeps the device region when the language matches", () => {
    expect(formatLocaleFor("es", "es-MX")).toBe("es-MX");
    expect(formatLocaleFor("en", "en-GB")).toBe("en-GB");
  });

  it("ignores the device when the language differs or has no region", () => {
    expect(formatLocaleFor("es", "en-US")).toBe("es-CO");
    expect(formatLocaleFor("en", "es")).toBe("en-US");
    expect(formatLocaleFor("es", "not a tag!!")).toBe("es-CO");
  });
});
