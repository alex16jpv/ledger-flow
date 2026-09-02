import { deviceLocale, readLocaleMode, writeLocaleMode } from "./locale-preference";

describe("locale preference", () => {
  it("maps the device language to a supported locale", () => {
    expect(deviceLocale("es-CO")).toBe("es");
    expect(deviceLocale("en-GB")).toBe("en");
    expect(deviceLocale("fr-FR")).toBe("en");
    expect(deviceLocale(undefined)).toBe("en");
  });

  it("round-trips the mode and defaults to fixed", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readLocaleMode(storage)).toBe("fixed");
    writeLocaleMode(storage, "device");
    expect(readLocaleMode(storage)).toBe("device");
    expect(readLocaleMode(null)).toBe("fixed");
  });
});
