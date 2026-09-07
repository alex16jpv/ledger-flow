import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "color"
> {
  selected?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const BASE =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-[background,color,border-color] duration-(--dur-1) ease-(--ease)";

export function Chip({
  selected = false,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        BASE,
        selected
          ? "border-ink bg-ink text-on-ink"
          : "border-border-strong bg-surface text-text-2 hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface CategoryChipProps extends ChipProps {
  color?: ColorToken | null;
}

export function CategoryChip({
  selected = false,
  icon,
  color,
  className,
  children,
  type = "button",
  ...rest
}: CategoryChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      style={featureColorStyle(color)}
      className={cn(
        BASE,
        "pl-1.5",
        selected
          ? "border-(--f) bg-(--f-soft) text-(--f-text)"
          : "border-border-strong bg-surface text-text-2 hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center rounded-[6px] bg-(--f-soft) text-(--f-text) [&>svg]:size-3 [&>svg]:stroke-[2.25]"
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

export function ChipRow({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto pb-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
