import {
  DEFAULT_THEME,
  isMode,
  isPalette,
  type Mode,
  type ResolvedMode,
  STORAGE_KEYS,
  type Theme,
} from "./palettes";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readStoredTheme(storage: StorageLike | null): Theme {
  if (!storage) return DEFAULT_THEME;
  try {
    const palette = storage.getItem(STORAGE_KEYS.palette);
    const mode = storage.getItem(STORAGE_KEYS.mode);
    return {
      palette: isPalette(palette) ? palette : DEFAULT_THEME.palette,
      mode: isMode(mode) ? mode : DEFAULT_THEME.mode,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(storage: StorageLike | null, theme: Theme): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.palette, theme.palette);
    storage.setItem(STORAGE_KEYS.mode, theme.mode);
  } catch {
    return;
  }
}

export function resolveMode(mode: Mode, prefersDark: boolean): ResolvedMode {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.dataset.palette = theme.palette;
  if (theme.mode === "system") delete root.dataset.mode;
  else root.dataset.mode = theme.mode;
}

export function syncThemeColor(doc: Document): void {
  const color = getComputedStyle(doc.documentElement).getPropertyValue("--bg").trim();
  if (!color) return;
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.name = "theme-color";
    doc.head.appendChild(meta);
  }
  meta.content = color;
}
