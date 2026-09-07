import type { HTMLAttributes, ReactNode } from "react";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";

export type TileSize = "sm" | "md" | "lg";
export type TileVariant = "soft" | "solid" | "outline";

export interface TileProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  size?: TileSize;
  variant?: TileVariant;
  color?: ColorToken | null;
  children: ReactNode;
}

const SIZE: Record<TileSize, string> = {
  sm: "size-8 rounded-[9px]",
  md: "size-10 rounded-[12px]",
  lg: "size-14 rounded-[16px]",
};

const VARIANT: Record<TileVariant, string> = {
  soft: "bg-(--f-soft) text-(--f-text)",
  solid: "bg-(--f) text-on-brand",
  outline: "border-[1.5px] border-dashed border-border-strong bg-transparent text-text-3",
};

export function Tile({
  size = "md",
  variant = "soft",
  color,
  className,
  style,
  children,
  ...rest
}: TileProps) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center", SIZE[size], VARIANT[variant], className)}
      style={{ ...featureColorStyle(color), ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color?: ColorToken | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full bg-(--f)", className)}
      style={featureColorStyle(color)}
    />
  );
}
