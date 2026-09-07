"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";

import { shiftDayKey } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { iconProps } from "@/lib/icons/sizes";

import { Button } from "./Button";
import { Chip, ChipRow } from "./Chip";
import { cn } from "./cn";
import { Sheet } from "./Sheet";

// 7.28: the browser's calendar follows neither the tokens nor the app's language, and it cannot grey
// out the days the server refuses. This one does both. Days are plain `YYYY-MM-DD` keys, never Date
// objects: the value is a calendar day in the user's zone, not an instant.
export interface DatePickerSheetProps {
  open: boolean;
  value: string;
  // Nothing after this day can be chosen. The transaction form sets it to tomorrow (the server
  // refuses more than 24 h ahead); a budget's period has no ceiling at all.
  max?: string;
  min?: string;
  title: string;
  // Why the days at the end are out of reach, where there is a reason worth giving.
  note?: string;
  today: string;
  onChange: (day: string) => void;
  onClose: () => void;
}

const pad = (value: number): string => String(value).padStart(2, "0");

const key = (year: number, month: number, day: number): string =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const partsOf = (day: string): { year: number; month: number; day: number } => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return { year, month: month - 1, day: date };
};

const shiftMonthKey = (day: string, months: number): string => {
  const { year, month, day: date } = partsOf(day);
  const first = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return key(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date, lastDay));
};

// `getWeekInfo` is in every browser this app supports and not yet in TypeScript's lib.
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => { firstDay: number } };

// Which weekday the grid starts on, from the language: Monday nearly everywhere, Sunday in en-US.
// `firstDay` counts 1 = Monday … 7 = Sunday, and the grid counts Sunday as 0.
function firstWeekday(locale: string): number {
  try {
    const week = (new Intl.Locale(locale) as LocaleWithWeek).getWeekInfo?.();
    return week ? week.firstDay % 7 : 1;
  } catch {
    return 1;
  }
}

// The 7 × n window a month is drawn in, neighbours included, as day keys: whole weeks, and no more
// of them than the month needs — a sixth row would repeat a day number that is already on screen.
function monthGrid(month: string, startsOn: number): string[] {
  const { year, month: index } = partsOf(month);
  const first = new Date(Date.UTC(year, index, 1));
  const lead = (first.getUTCDay() - startsOn + 7) % 7;
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, index, 1 - lead));
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, offset) => {
    const at = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + offset),
    );
    return key(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  });
}

export function DatePickerSheet({
  open,
  value,
  max,
  min,
  title,
  note,
  today,
  onChange,
  onClose,
}: DatePickerSheetProps) {
  const t = useTranslations("common");
  const { formatLocale, timeZone } = useFormatSettings();
  // The sheet is a decision of its own: it opens on the value it was given and reports only on Done,
  // and the opener remounts it on every open so that a cancelled edit leaves nothing behind.
  const [draft, setDraft] = useState(value);

  const startsOn = firstWeekday(formatLocale);
  const grid = monthGrid(draft, startsOn);
  const shown = partsOf(draft);
  const monthLabel = new Intl.DateTimeFormat(formatLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(shown.year, shown.month, 1)));
  // A screen reader hearing "30" learns nothing: the cell carries the whole day, and the neighbours
  // of the month are told apart by it too.
  const fullDate = new Intl.DateTimeFormat(formatLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekdays = Array.from({ length: 7 }, (_, offset) =>
    new Intl.DateTimeFormat(formatLocale, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 8, 6 + ((startsOn + offset) % 7))),
    ),
  );

  const outOfRange = (day: string): boolean =>
    (max !== undefined && day > max) || (min !== undefined && day < min);
  const move = (days: number) => {
    const next = shiftDayKey(draft, days);
    if (!outOfRange(next)) setDraft(next);
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = steps[event.key];
    if (step !== undefined) {
      event.preventDefault();
      move(step);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = shiftMonthKey(draft, event.key === "PageUp" ? -1 : 1);
      if (!outOfRange(next)) setDraft(next);
    }
  }

  const nextMonthFirst = `${shiftMonthKey(`${draft.slice(0, 8)}01`, 1).slice(0, 8)}01`;
  const chip = (day: string, label: string) =>
    outOfRange(day) ? null : (
      <Chip
        selected={draft === day}
        onClick={() => {
          setDraft(day);
        }}
      >
        {label}
      </Chip>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            size="lg"
            block
            onClick={() => {
              onChange(draft);
              onClose();
            }}
          >
            {t("done")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ChipRow>
          {chip(today, t("today"))}
          {chip(shiftDayKey(today, -1), t("yesterday"))}
        </ChipRow>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            round
            aria-label={t("previousMonth")}
            onClick={() => {
              setDraft(shiftMonthKey(draft, -1));
            }}
          >
            <ChevronLeft {...iconProps("sm")} />
          </Button>
          <span className="text-md font-semibold">{monthLabel}</span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            round
            aria-label={t("nextMonth")}
            disabled={max !== undefined && nextMonthFirst > max}
            onClick={() => {
              setDraft(shiftMonthKey(draft, 1));
            }}
          >
            <ChevronRight {...iconProps("sm")} />
          </Button>
        </div>
        <div
          role="grid"
          aria-label={monthLabel}
          onKeyDown={onKeyDown}
          className="grid grid-cols-7 gap-1"
        >
          {weekdays.map((label) => (
            <span key={label} className="py-1 text-center text-xs text-text-3">
              {label}
            </span>
          ))}
          {grid.map((day) => {
            const parts = partsOf(day);
            const disabled = outOfRange(day);
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-label={fullDate.format(new Date(`${day}T00:00:00Z`))}
                aria-selected={draft === day}
                aria-current={day === today ? "date" : undefined}
                disabled={disabled}
                // Only the chosen day is a tab stop: inside the grid the arrows move (7.28).
                tabIndex={draft === day ? 0 : -1}
                onClick={() => {
                  setDraft(day);
                }}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md text-sm transition-[background,color] duration-(--dur-1) ease-(--ease)",
                  parts.month === shown.month ? "text-text" : "text-text opacity-55",
                  day === today && draft !== day && "ring-1 ring-border-strong",
                  draft === day ? "bg-brand text-on-brand" : "hover:bg-surface-2",
                  disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                )}
              >
                {parts.day}
              </button>
            );
          })}
        </div>
        {note && <p className="text-sm text-text-3">{note}</p>}
        <p className="text-sm text-text-3">{t("savedInZone", { zone: timeZone })}</p>
      </div>
    </Sheet>
  );
}
