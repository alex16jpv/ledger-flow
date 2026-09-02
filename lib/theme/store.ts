import { readStoredTheme, writeStoredTheme } from "./apply";
import { DEFAULT_THEME, type Theme } from "./palettes";

type Listener = () => void;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<Listener>();
let snapshot: Theme | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

export const themeStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): Theme => {
    snapshot ??= readStoredTheme(storage());
    return snapshot;
  },
  getServerSnapshot: (): Theme => DEFAULT_THEME,
  set: (theme: Theme, { persist = true }: { persist?: boolean } = {}): void => {
    const current = themeStore.getSnapshot();
    if (current.palette === theme.palette && current.mode === theme.mode) return;
    snapshot = theme;
    if (persist) writeStoredTheme(storage(), theme);
    emit();
  },
  reset: (): void => {
    snapshot = null;
  },
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

export const prefersDarkStore = {
  subscribe: (listener: Listener): (() => void) => {
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  },
  getSnapshot: (): boolean => window.matchMedia(DARK_QUERY).matches,
  getServerSnapshot: (): boolean => false,
};
