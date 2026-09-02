import { THEME_INIT_SCRIPT } from "./init-script";
import { STORAGE_KEYS } from "./palettes";

function run() {
  new Function(THEME_INIT_SCRIPT)();
}

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-palette");
    document.documentElement.removeAttribute("data-mode");
  });

  it("applies the stored palette and mode before paint", () => {
    window.localStorage.setItem(STORAGE_KEYS.palette, "tinta");
    window.localStorage.setItem(STORAGE_KEYS.mode, "dark");
    run();
    expect(document.documentElement.dataset.palette).toBe("tinta");
    expect(document.documentElement.dataset.mode).toBe("dark");
  });

  it("falls back to the default palette when nothing or garbage is stored", () => {
    window.localStorage.setItem(STORAGE_KEYS.palette, "neon");
    window.localStorage.setItem(STORAGE_KEYS.mode, "system");
    run();
    expect(document.documentElement.dataset.palette).toBe("brisa");
    expect(document.documentElement.dataset.mode).toBeUndefined();
  });
});
