import type { DaySlot } from "@/lib/charts/days";
import { fromCents, toCents } from "@/lib/local/derive";
import type { Budget } from "@/types/api";

export interface PaceSeries {
  // One point per day boundary, so a period of n days has n + 1 of them, starting at zero.
  spent: (number | null)[];
  pace: number[];
  projection: (number | null)[] | null;
  endsAt: number | null;
  elapsedDays: number;
  days: number;
  spentSoFar: number;
}

// Rule 4's exception: these are the API's own day buckets added up, never money the client invented.
function runningTotals(bars: readonly DaySlot[]): number[] {
  let cents = 0;
  return bars.map((bar) => {
    cents += toCents(bar.value);
    return fromCents(cents);
  });
}

// The projection needs a rate, and one elapsed day is not a rate: on day 1 there is nothing to draw.
const MIN_DAYS_TO_PROJECT = 2;

export function paceSeries(bars: readonly DaySlot[], amount: number): PaceSeries {
  const days = bars.length;
  const elapsed = bars.filter((bar) => !bar.future);
  const elapsedDays = elapsed.length;
  const totals = runningTotals(elapsed);
  const spentSoFar = totals.at(-1) ?? 0;
  const spent: (number | null)[] = [
    0,
    ...totals,
    ...Array.from({ length: days - elapsedDays }, () => null),
  ];
  const pace = Array.from({ length: days + 1 }, (_, day) => (days > 0 ? (amount * day) / days : 0));

  if (elapsedDays < MIN_DAYS_TO_PROJECT || elapsedDays >= days || spentSoFar <= 0) {
    return { spent, pace, projection: null, endsAt: null, elapsedDays, days, spentSoFar };
  }
  const endsAt = fromCents(Math.round((toCents(spentSoFar) / elapsedDays) * days));
  const projection = Array.from({ length: days + 1 }, (_, day) => {
    if (day < elapsedDays) return null;
    if (day === elapsedDays) return spentSoFar;
    const share = (day - elapsedDays) / (days - elapsedDays);
    return fromCents(
      toCents(spentSoFar) + Math.round((toCents(endsAt) - toCents(spentSoFar)) * share),
    );
  });
  return { spent, pace, projection, endsAt, elapsedDays, days, spentSoFar };
}

// A CUSTOM budget is one window that never repeats, so it has no history to line up against.
export function hasPeriodHistory(budget: Pick<Budget, "periodType">): boolean {
  return budget.periodType !== "CUSTOM";
}
