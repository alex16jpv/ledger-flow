"use client";

import { CircleCheck } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { iconProps } from "@/lib/icons/sizes";
import { type Palette, paletteSampleVars } from "@/lib/theme/palettes";

interface PaletteCardProps {
  palette: Palette;
  name: string;
  description: string;
  selected: boolean;
  onSelect: (palette: Palette) => void;
}

export function PaletteCard({ palette, name, description, selected, onSelect }: PaletteCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        onSelect(palette);
      }}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left shadow-1",
        selected && "outline-2 -outline-offset-1 outline-brand",
      )}
    >
      <span className="flex items-center justify-between gap-2 font-medium">
        {name}
        {selected && <CircleCheck {...iconProps("sm")} className="text-brand-text" />}
      </span>
      <span className="flex gap-1">
        {paletteSampleVars(palette).map((color) => (
          <span
            key={color}
            aria-hidden="true"
            className="size-3.5 rounded-full"
            style={{ background: color }}
          />
        ))}
      </span>
      <span className="text-xs text-text-3">{description}</span>
    </button>
  );
}
