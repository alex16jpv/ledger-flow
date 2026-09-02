export const PALETTES = ["brisa", "tinta"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "brisa";

export const MODES = ["light", "dark", "system"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_MODE: Mode = "system";

export type ResolvedMode = Exclude<Mode, "system">;

export interface Theme {
  palette: Palette;
  mode: Mode;
}

export const DEFAULT_THEME: Theme = { palette: DEFAULT_PALETTE, mode: DEFAULT_MODE };

export const STORAGE_KEYS = { palette: "lf.palette", mode: "lf.mode" } as const;

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

// Sample dots for the palette cards live in tokens/samples.css (five per palette: brand + four seeds).
export function paletteSampleVars(palette: Palette): string[] {
  return ["brand", "1", "2", "3", "4"].map((slot) => `var(--sample-${palette}-${slot})`);
}
