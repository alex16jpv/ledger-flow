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

import { dayKey, localDateTime } from "@/lib/format/dates";
import type { SyncBudget } from "@/types/api";

export type PeriodDefinition = Pick<SyncBudget, "periodType" | "periodStartDate" | "periodEndDate">;

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  key: string;
}

// A fixed Monday grid shared by every budget of every user, so the same fortnight resolves alike.
const BIWEEKLY_ANCHOR = new Date(2024, 0, 1);

const MONDAY = { weekStartsOn: 1 } as const;

const pad = (value: number): string => String(value).padStart(2, "0");

// Noon is the one wall clock no zone skips, so the device's own daylight change cannot move the date.
function localNoonOf(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}

function dayOf(naive: Date): string {
  return `${naive.getFullYear()}-${pad(naive.getMonth() + 1)}-${pad(naive.getDate())}`;
}

function startOfLocalDay(naive: Date, timeZone: string): Date {
  return localDateTime(dayOf(naive), "00:00", timeZone);
}

// Same rules as the server's `shared/budgetPeriod.ts`: the key is a $set path, so never a dot.
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

  const local = localNoonOf(dayKey(reference, timeZone));

  if (budget.periodType === "BIWEEKLY") {
    const weekStart = startOfWeek(local, MONDAY);
    const weeks = differenceInCalendarWeeks(
      weekStart,
      startOfWeek(BIWEEKLY_ANCHOR, MONDAY),
      MONDAY,
    );
    const start = subWeeks(weekStart, ((weeks % 2) + 2) % 2);
    return {
      from: startOfLocalDay(start, timeZone),
      to: startOfLocalDay(addWeeks(start, 2), timeZone),
      key: format(start, "RRRR-'BW'II"),
    };
  }

  const start = startOf(budget.periodType, local);
  return {
    from: startOfLocalDay(start, timeZone),
    to: startOfLocalDay(endOf(budget.periodType, start), timeZone),
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
