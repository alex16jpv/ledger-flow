import type { CSSProperties } from "react";

import type { components } from "@/types/api";

export const COLOR_TOKENS = [
  "RED",
  "ORANGE",
  "AMBER",
  "YELLOW",
  "LIME",
  "GREEN",
  "TEAL",
  "CYAN",
  "BLUE",
  "INDIGO",
  "PURPLE",
  "PINK",
  "ROSE",
  "GRAY",
  "BROWN",
  "BLACK",
] as const satisfies readonly ColorToken[];

export type ColorToken = NonNullable<components["schemas"]["Account"]["color"]>;

export type FeatureColorStyle = CSSProperties &
  Record<"--f" | "--f-soft" | "--f-text" | "--f-border", string>;

export function isColorToken(value: unknown): value is ColorToken {
  return typeof value === "string" && (COLOR_TOKENS as readonly string[]).includes(value);
}

// Sets the four --f* roles of DESIGN.md §2.3 so children can use var(--f), var(--f-soft), etc.
export function featureColorStyle(
  token: ColorToken | null | undefined,
): FeatureColorStyle | undefined {
  if (!isColorToken(token)) return undefined;
  const name = token.toLowerCase();
  return {
    "--f": `var(--c-${name})`,
    "--f-soft": `var(--c-${name}-soft)`,
    "--f-text": `var(--c-${name}-text)`,
    "--f-border": `var(--c-${name}-border)`,
  };
}
