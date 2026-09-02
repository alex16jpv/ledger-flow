import type { HTMLAttributes, Ref } from "react";

import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  flush?: boolean;
  tinted?: ColorToken | null;
  ref?: Ref<HTMLDivElement>;
}

export function Card({
  flush = false,
  tinted,
  className,
  style,
  children,
  ref,
  ...rest
}: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border shadow-1",
        tinted ? "border-(--f-border) bg-(--f-soft)" : "border-border bg-surface",
        flush ? "overflow-hidden p-0" : "p-4",
        className,
      )}
      style={{ ...featureColorStyle(tinted), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Inset({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-md bg-surface-2 p-3", className)} {...rest}>
      {children}
    </div>
  );
}
