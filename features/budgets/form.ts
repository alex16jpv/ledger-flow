import { z } from "zod";

import { dayKey, daysWindow, localDateTime } from "@/lib/format/dates";
import { MAX_AMOUNT } from "@/lib/format/money";
import { COLOR_TOKENS } from "@/lib/theme/feature-color";
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from "@/types/api";

import { BUDGET_PERIOD_TYPES } from "./progress";

export const BUDGET_NAME_MAX = 255;
export const BUDGET_NOTE_MAX = 255;
// The API accepts up to 20 categories, but the owner limits a budget to one (2026-09-02): a category can
// only sit in one budget per period type, so several per budget only made overlaps harder to explain.
export const BUDGET_CATEGORIES_MAX = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CUSTOM_DAYS = 30;

export type BudgetScope = "global" | "categories";

export const budgetFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "validation.required" })
      .max(BUDGET_NAME_MAX, { error: "validation.nameMax" }),
    scope: z.enum(["global", "categories"]),
    categoryIds: z.array(z.string()).max(BUDGET_CATEGORIES_MAX, { error: "validation.tooMany" }),
    periodType: z.enum(BUDGET_PERIOD_TYPES),
    periodStartDate: z.string(),
    periodEndDate: z.string(),
    amount: z
      .number({ error: "validation.amountInvalid" })
      .positive({ error: "validation.amountPositive" })
      .max(MAX_AMOUNT, { error: "validation.amountMax" }),
    color: z.enum(COLOR_TOKENS),
    effectiveFrom: z.string(),
    note: z.string().trim().max(BUDGET_NOTE_MAX, { error: "validation.nameMax" }),
  })
  .superRefine((values, context) => {
    if (values.scope === "categories" && values.categoryIds.length === 0)
      context.addIssue({ code: "custom", path: ["categoryIds"], message: "validation.required" });
    if (values.periodType === "CUSTOM") {
      if (!DATE.test(values.periodStartDate))
        context.addIssue({
          code: "custom",
          path: ["periodStartDate"],
          message: "validation.required",
        });
      if (!DATE.test(values.periodEndDate))
        context.addIssue({
          code: "custom",
          path: ["periodEndDate"],
          message: "validation.required",
        });
      if (
        DATE.test(values.periodStartDate) &&
        DATE.test(values.periodEndDate) &&
        values.periodStartDate > values.periodEndDate
      )
        context.addIssue({
          code: "custom",
          path: ["periodEndDate"],
          message: "validation.dateOrder",
        });
    }
    if (values.effectiveFrom && !DATE.test(values.effectiveFrom))
      context.addIssue({ code: "custom", path: ["effectiveFrom"], message: "validation.invalid" });
  });

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function defaultBudgetValues(now: Date, timeZone: string): BudgetFormValues {
  const start = dayKey(now, timeZone);
  const end = dayKey(new Date(now.getTime() + DEFAULT_CUSTOM_DAYS * 86_400_000), timeZone);
  return {
    name: "",
    scope: "categories",
    categoryIds: [],
    periodType: "MONTHLY",
    periodStartDate: start,
    periodEndDate: end,
    amount: Number.NaN,
    color: "TEAL",
    effectiveFrom: "",
    note: "",
  };
}

// The API window is half-open: the inclusive end date the user picks becomes the next local midnight.
function customWindow(values: BudgetFormValues, timeZone: string) {
  const window = daysWindow(values.periodStartDate, values.periodEndDate, timeZone);
  return { periodStartDate: window.from.toISOString(), periodEndDate: window.to.toISOString() };
}

export function toCreateInput(values: BudgetFormValues, timeZone: string): CreateBudgetInput {
  return {
    name: values.name,
    color: values.color,
    categoryIds: values.scope === "global" ? [] : values.categoryIds,
    type: "EXPENSE",
    amount: values.amount,
    periodType: values.periodType,
    ...(values.periodType === "CUSTOM" ? customWindow(values, timeZone) : {}),
    ...(values.effectiveFrom
      ? { effectiveFrom: localDateTime(values.effectiveFrom, "00:00", timeZone).toISOString() }
      : {}),
    note: values.note || null,
  };
}

export function toUpdateInput(
  values: BudgetFormValues,
  original: Budget,
  timeZone: string,
): UpdateBudgetInput {
  const next = toCreateInput(values, timeZone);
  const input: UpdateBudgetInput = {
    name: next.name,
    color: next.color,
    categoryIds: next.categoryIds,
    amount: next.amount,
    note: next.note,
  };
  const periodChanged =
    next.periodType !== original.periodType ||
    (next.periodType === "CUSTOM" &&
      (next.periodStartDate !== original.periodFrom || next.periodEndDate !== original.periodTo));
  if (periodChanged) {
    input.periodType = next.periodType;
    if (next.periodType === "CUSTOM") {
      input.periodStartDate = next.periodStartDate;
      input.periodEndDate = next.periodEndDate;
    }
  }
  if (values.effectiveFrom) input.effectiveFrom = next.effectiveFrom;
  return input;
}

export function fromBudget(
  budget: Budget,
  timeZone: string,
  mode: "edit" | "copy",
  now: Date,
): BudgetFormValues {
  const defaults = defaultBudgetValues(now, timeZone);
  const custom = budget.periodType === "CUSTOM";
  const start = new Date(budget.periodFrom);
  const end = new Date(new Date(budget.periodTo).getTime() - 1);
  const copyEnd = new Date(now.getTime() + (end.getTime() - start.getTime()));
  return {
    name: budget.name,
    scope: budget.categoryIds.length === 0 ? "global" : "categories",
    categoryIds: [...budget.categoryIds],
    periodType: budget.periodType,
    periodStartDate: custom
      ? mode === "edit"
        ? dayKey(start, timeZone)
        : dayKey(now, timeZone)
      : defaults.periodStartDate,
    periodEndDate: custom
      ? mode === "edit"
        ? dayKey(end, timeZone)
        : dayKey(copyEnd, timeZone)
      : defaults.periodEndDate,
    amount: budget.baseAmount,
    color: budget.color,
    effectiveFrom: mode === "edit" ? dayKey(new Date(budget.effectiveFrom), timeZone) : "",
    note: budget.note ?? "",
  };
}

// Owner request F-01: suggestions follow the currency's real scale (or the user's own spending) instead of the decimal count.
const CURRENCY_SUGGESTIONS: Record<string, readonly number[]> = {
  COP: [1_500_000, 2_000_000, 3_000_000],
  CLP: [800_000, 1_000_000, 1_500_000],
  ARS: [800_000, 1_000_000, 1_500_000],
  PYG: [4_000_000, 6_000_000, 8_000_000],
  MXN: [15_000, 20_000, 30_000],
  PEN: [2_000, 3_000, 4_000],
  BRL: [3_000, 4_000, 6_000],
  UYU: [30_000, 40_000, 60_000],
  BOB: [4_000, 6_000, 8_000],
  DOP: [40_000, 60_000, 80_000],
  GTQ: [5_000, 8_000, 10_000],
  HNL: [15_000, 20_000, 30_000],
  NIO: [20_000, 30_000, 40_000],
  CRC: [400_000, 600_000, 800_000],
  JPY: [150_000, 200_000, 300_000],
  KRW: [1_500_000, 2_000_000, 3_000_000],
  IDR: [15_000_000, 20_000_000, 30_000_000],
  VND: [30_000_000, 40_000_000, 60_000_000],
  INR: [30_000, 40_000, 60_000],
  PHP: [40_000, 60_000, 80_000],
  ZAR: [15_000, 20_000, 30_000],
  NGN: [400_000, 600_000, 800_000],
  TRY: [30_000, 40_000, 60_000],
  EGP: [15_000, 20_000, 30_000],
};

export function roundToNice(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.max(step, Math.round(value / step) * step);
}

export function budgetSuggestions(
  currency: string,
  fractionDigits: number,
  lastMonthSpent: number | null = null,
): number[] {
  if (lastMonthSpent && lastMonthSpent > 0) {
    const around = [0.8, 1, 1.2].map((factor) => roundToNice(lastMonthSpent * factor));
    return [...new Set(around)];
  }
  return [
    ...(CURRENCY_SUGGESTIONS[currency] ??
      (fractionDigits === 0 ? [150_000, 200_000, 300_000] : [1_500, 2_000, 3_000])),
  ];
}
