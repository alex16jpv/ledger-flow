import { isMode, isPalette, type Theme } from "./palettes";

const UNSENT_KEY = "lf.themeUnsent";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function stored(): (Theme & { userId: string }) | null {
  try {
    const raw = storage()?.getItem(UNSENT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { userId, palette, mode } = value as Record<string, unknown>;
    return typeof userId === "string" && isPalette(palette) && isMode(mode)
      ? { userId, palette, mode }
      : null;
  } catch {
    return null;
  }
}

export const unsentTheme = {
  mark: (userId: string, theme: Theme): void => {
    try {
      storage()?.setItem(
        UNSENT_KEY,
        JSON.stringify({ userId, palette: theme.palette, mode: theme.mode }),
      );
    } catch {
      return;
    }
  },
  read: (userId: string): Theme | null => {
    const unsent = stored();
    return unsent?.userId === userId ? { palette: unsent.palette, mode: unsent.mode } : null;
  },
  clear: (sent?: Theme): void => {
    const unsent = stored();
    if (sent && unsent && (unsent.palette !== sent.palette || unsent.mode !== sent.mode)) return;
    try {
      storage()?.removeItem(UNSENT_KEY);
    } catch {
      return;
    }
  },
};
