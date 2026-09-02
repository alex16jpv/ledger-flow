import {
  applyTheme,
  readStoredTheme,
  resolveMode,
  syncThemeColor,
  writeStoredTheme,
} from "./apply";
import { DEFAULT_THEME, STORAGE_KEYS } from "./palettes";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("readStoredTheme", () => {
  it("returns the default theme without storage", () => {
    expect(readStoredTheme(null)).toEqual(DEFAULT_THEME);
  });

  it("ignores unknown values", () => {
    const storage = memoryStorage({ [STORAGE_KEYS.palette]: "neon", [STORAGE_KEYS.mode]: "sepia" });
    expect(readStoredTheme(storage)).toEqual(DEFAULT_THEME);
  });

  it("reads a valid theme", () => {
    const storage = memoryStorage({ [STORAGE_KEYS.palette]: "brisa", [STORAGE_KEYS.mode]: "dark" });
    expect(readStoredTheme(storage)).toEqual({ palette: "brisa", mode: "dark" });
  });

  it("survives a throwing storage", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readStoredTheme(storage)).toEqual(DEFAULT_THEME);
  });
});

describe("writeStoredTheme", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    writeStoredTheme(storage, { palette: "brisa", mode: "light" });
    expect(readStoredTheme(storage)).toEqual({ palette: "brisa", mode: "light" });
  });
});

describe("resolveMode", () => {
  it("follows the system preference only in system mode", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});

describe("applyTheme", () => {
  it("sets the palette and an explicit mode", () => {
    const root = document.createElement("html");
    applyTheme(root, { palette: "brisa", mode: "dark" });
    expect(root.dataset.palette).toBe("brisa");
    expect(root.dataset.mode).toBe("dark");
  });

  it("removes data-mode for system so light-dark() follows the OS", () => {
    const root = document.createElement("html");
    root.dataset.mode = "dark";
    applyTheme(root, { palette: "tinta", mode: "system" });
    expect(root.dataset.mode).toBeUndefined();
  });
});

describe("syncThemeColor", () => {
  it("mirrors --bg into the theme-color meta", () => {
    document.documentElement.style.setProperty("--bg", "fixture-bg");
    syncThemeColor(document);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe("fixture-bg");
    syncThemeColor(document);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });
});
