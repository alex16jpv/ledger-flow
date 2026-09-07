"use client";

import { useTranslations } from "next-intl";

import { COLOR_TOKENS, type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export interface SwatchProps {
  color: ColorToken;
  selected: boolean;
  onSelect: (color: ColorToken) => void;
  label: string;
}

export function Swatch({ color, selected, onSelect, label }: SwatchProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={() => {
          onSelect(color);
        }}
        style={featureColorStyle(color)}
        className={cn(
          "relative size-7 rounded-full bg-(--f) shadow-[inset_0_0_0_1px_var(--border)]",
          "after:absolute after:-inset-[5px] after:rounded-full after:border-2",
          selected ? "after:border-text" : "after:border-transparent",
        )}
      />
    </Tooltip>
  );
}

export interface SwatchGridProps {
  value: ColorToken | null;
  onChange: (color: ColorToken) => void;
  label: string;
  className?: string;
}

export function SwatchGrid({ value, onChange, label, className }: SwatchGridProps) {
  const t = useTranslations("colors");
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap gap-x-3.5 gap-y-3 px-0.5 py-1", className)}
    >
      {COLOR_TOKENS.map((color) => (
        <Swatch
          key={color}
          color={color}
          selected={value === color}
          onSelect={onChange}
          label={t(color)}
        />
      ))}
    </div>
  );
}
