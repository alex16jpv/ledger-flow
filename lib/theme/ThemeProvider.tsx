"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { applyTheme, resolveMode, syncThemeColor } from "./apply";
import { type Mode, type Palette, type ResolvedMode, type Theme } from "./palettes";
import { prefersDarkStore, themeStore } from "./store";

interface ThemeContextValue extends Theme {
  resolvedMode: ResolvedMode;
  setPalette: (palette: Palette) => void;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  const prefersDark = useSyncExternalStore(
    prefersDarkStore.subscribe,
    prefersDarkStore.getSnapshot,
    prefersDarkStore.getServerSnapshot,
  );

  useEffect(() => {
    applyTheme(document.documentElement, theme);
    syncThemeColor(document);
  }, [theme, prefersDark]);

  const setPalette = useCallback((palette: Palette) => {
    themeStore.set({ ...themeStore.getSnapshot(), palette });
  }, []);

  const setMode = useCallback((mode: Mode) => {
    themeStore.set({ ...themeStore.getSnapshot(), mode });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...theme, resolvedMode: resolveMode(theme.mode, prefersDark), setPalette, setMode }),
    [theme, prefersDark, setPalette, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires a ThemeProvider");
  return context;
}
