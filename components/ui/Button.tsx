import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "./cn";

export type ButtonVariant =
  "primary" | "secondary" | "soft" | "ghost" | "danger" | "dangerGhost" | "dangerSolid" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  round?: boolean;
  block?: boolean;
}

// `cn` is a plain join, so a border colour in the base class wins by stylesheet order, not by variant.
const VARIANT: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-brand text-on-brand hover:bg-brand-hover",
  secondary: "border-border-strong bg-surface text-text hover:bg-surface-2",
  soft: "border-transparent bg-brand-soft text-brand-text",
  ghost: "border-transparent bg-transparent text-text-2 hover:bg-surface-2 hover:text-text",
  danger: "border-transparent bg-danger-soft text-danger",
  dangerGhost: "border-transparent bg-transparent text-danger hover:bg-danger-soft",
  dangerSolid: "border-transparent bg-danger-solid text-on-brand",
  ink: "border-transparent bg-ink text-on-ink",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-(--control-sm) text-sm",
  md: "h-(--control-md) text-base",
  lg: "h-(--control-lg) text-md",
};

const PADDING: Record<ButtonSize, string> = { sm: "px-3", md: "px-4", lg: "px-5" };
const RADIUS: Record<ButtonSize, string> = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg" };
const ICON_ONLY: Record<ButtonSize, string> = {
  sm: "w-(--control-sm)",
  md: "w-(--control-md)",
  lg: "w-(--control-lg)",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
  round = false,
  block = false,
}: ButtonStyleProps = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 border font-medium whitespace-nowrap select-none",
    "transition-[background,border-color,color,transform] duration-(--dur-1) ease-(--ease) active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    iconOnly ? ICON_ONLY[size] : PADDING[size],
    round ? "rounded-full" : RADIUS[size],
    block && "w-full",
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    iconOnly,
    round,
    block,
    loading = false,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        buttonClasses({ variant, size, iconOnly, round, block }),
        "relative",
        className,
      )}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={cn("contents", loading && "invisible")}>{children}</span>
      {loading && (
        <span
          aria-hidden="true"
          className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent border-l-transparent motion-reduce:border-r-current motion-reduce:border-l-current"
        />
      )}
    </button>
  );
});
