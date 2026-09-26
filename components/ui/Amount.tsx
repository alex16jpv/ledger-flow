"use client";

import { useMoney } from "@/lib/i18n/useMoney";

import { cn } from "./cn";

export type AmountKind =
  "expense" | "income" | "transfer" | "adjustment" | "settlement" | "settlementOut";
export type AmountSize = "sm" | "base" | "lg" | "hero";

export interface AmountProps {
  value: number;
  kind?: AmountKind;
  size?: AmountSize;
  signed?: boolean;
  mutedParts?: boolean;
  className?: string;
}

const SIGN: Record<AmountKind, string> = {
  expense: "−",
  income: "+",
  transfer: "",
  adjustment: "±",
  settlement: "+",
  settlementOut: "−",
};

const KIND: Record<AmountKind, string> = {
  expense: "text-text",
  income: "text-income",
  transfer: "text-transfer",
  adjustment: "text-adjustment",
  // Money moved, but it is neither income nor spending: neutral, never green.
  settlement: "text-text",
  settlementOut: "text-text",
};

const SIZE: Record<AmountSize, string> = {
  sm: "text-sm font-medium",
  base: "text-base font-medium",
  lg: "text-2xl font-semibold tracking-[-0.02em]",
  hero: "text-4xl font-semibold tracking-[-0.03em] leading-[1.05]",
};

export function Amount({
  value,
  kind = "expense",
  size = "base",
  signed = true,
  mutedParts = true,
  className,
}: AmountProps) {
  const money = useMoney();
  const { symbol, integer, decimal, fraction } = money.parts(value);
  const sign = value < 0 ? "−" : signed ? SIGN[kind] : "";
  return (
    <span className={cn("whitespace-nowrap tabular-nums", KIND[kind], SIZE[size], className)}>
      {sign}
      <span
        className={cn(
          "mr-[0.15em] font-normal",
          mutedParts && "text-text-3",
          size === "hero" && "align-[0.55em] text-[0.5em] font-medium tracking-normal",
        )}
      >
        {symbol}
      </span>
      {integer}
      {fraction && (
        <span className={cn(mutedParts && "text-text-3")}>
          {decimal}
          {fraction}
        </span>
      )}
    </span>
  );
}
