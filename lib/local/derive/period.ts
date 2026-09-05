import {
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  differenceInCalendarWeeks,
  format,
  getQuarter,
  getYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subWeeks,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import type { SyncBudget } from "@/types/api";

export type PeriodDefinition = Pick<SyncBudget, "periodType" | "periodStartDate" | "periodEndDate">;

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  key: string;
}

// A fixed Monday grid shared by every budget of every user, so two budgets of the same fortnight
// always resolve to the same window.
const BIWEEKLY_ANCHOR = new Date(2024, 0, 1);

const MONDAY = { weekStartsOn: 1 } as const;

// The window [from, to) and the key of the period `reference` falls into, resolved in the user's
// zone. Same rules as the server's `shared/budgetPeriod.ts`: the key is also a Mongo $set path in
// `amountOverrides`, so it never carries a dot.
export function resolvePeriod(
  budget: PeriodDefinition,
  reference: Date,
  timeZone: string,
): ResolvedPeriod {
  if (budget.periodType === "CUSTOM") {
    if (!budget.periodStartDate || !budget.periodEndDate) {
      throw new Error("A CUSTOM budget needs both of its dates");
    }
    const from = new Date(budget.periodStartDate);
    const to = new Date(budget.periodEndDate);
    return { from, to, key: `${from.getTime()}_${to.getTime()}` };
  }

  const local = toZonedTime(reference, timeZone);

  if (budget.periodType === "BIWEEKLY") {
    const weekStart = startOfWeek(local, MONDAY);
    const weeks = differenceInCalendarWeeks(
      weekStart,
      startOfWeek(BIWEEKLY_ANCHOR, MONDAY),
      MONDAY,
    );
    const start = subWeeks(weekStart, ((weeks % 2) + 2) % 2);
    return {
      from: fromZonedTime(start, timeZone),
      to: fromZonedTime(addWeeks(start, 2), timeZone),
      key: format(start, "RRRR-'BW'II"),
    };
  }

  const start = startOf(budget.periodType, local);
  return {
    from: fromZonedTime(start, timeZone),
    to: fromZonedTime(endOf(budget.periodType, start), timeZone),
    key: periodKey(budget.periodType, start),
  };
}

type RecurringPeriod = Exclude<SyncBudget["periodType"], "CUSTOM" | "BIWEEKLY">;

function startOf(periodType: RecurringPeriod, local: Date): Date {
  switch (periodType) {
    case "WEEKLY":
      return startOfWeek(local, MONDAY);
    case "MONTHLY":
      return startOfMonth(local);
    case "QUARTERLY":
      return startOfQuarter(local);
    case "YEARLY":
      return startOfYear(local);
  }
}

function endOf(periodType: RecurringPeriod, start: Date): Date {
  switch (periodType) {
    case "WEEKLY":
      return addWeeks(start, 1);
    case "MONTHLY":
      return addMonths(start, 1);
    case "QUARTERLY":
      return addQuarters(start, 1);
    case "YEARLY":
      return addYears(start, 1);
  }
}

function periodKey(periodType: RecurringPeriod, start: Date): string {
  switch (periodType) {
    // ISO week-numbering year, which is not always the calendar year of the Monday.
    case "WEEKLY":
      return format(start, "RRRR-'W'II");
    case "MONTHLY":
      return format(start, "yyyy-MM");
    case "QUARTERLY":
      return `${getYear(start)}-Q${getQuarter(start)}`;
    case "YEARLY":
      return format(start, "yyyy");
  }
}
