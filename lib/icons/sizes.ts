export const ICON_SIZES = { sm: 16, md: 20, lg: 24 } as const;
export type IconSize = keyof typeof ICON_SIZES;

// DESIGN.md §4.1: stroke 1.75 at 20 px, heavier at 16 px, lighter at 24 px.
const STROKE_WIDTHS: Record<IconSize, number> = { sm: 2, md: 1.75, lg: 1.5 };

export function iconProps(size: IconSize = "md") {
  return { size: ICON_SIZES[size], strokeWidth: STROKE_WIDTHS[size], "aria-hidden": true } as const;
}
