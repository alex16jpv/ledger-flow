"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";

import { Button } from "./Button";
import { cn } from "./cn";
import { Sheet } from "./Sheet";

// 7.28: the other half of the browser's control. The value is `HH:mm` in the user's zone, and the
// wheel shows it the way the language does — twelve hours with AM/PM where that is how time is read.
export interface TimePickerSheetProps {
  open: boolean;
  value: string;
  title: string;
  now: string;
  onChange: (time: string) => void;
  onClose: () => void;
}

const MINUTE_STEP = 5;
const pad = (value: number): string => String(value).padStart(2, "0");

const partsOf = (time: string): { hour: number; minute: number } => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return { hour, minute };
};

// Only the minutes the wheel offers exist on it, so a value between two of them rounds down rather
// than showing nothing selected.
const snap = (minute: number): number => minute - (minute % MINUTE_STEP);

function uses12Hour(locale: string): boolean {
  return new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 === true;
}

function Column({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="flex h-56 flex-1 snap-y snap-mandatory flex-col gap-1 overflow-y-auto py-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          onClick={() => {
            onSelect(option.value);
          }}
          className={cn(
            "shrink-0 snap-center rounded-md py-2 text-center text-md transition-[background,color] duration-(--dur-1) ease-(--ease)",
            option.value === value
              ? "bg-surface font-semibold text-text shadow-1"
              : "text-text-2 hover:bg-surface-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TimePickerSheet({
  open,
  value,
  title,
  now,
  onChange,
  onClose,
}: TimePickerSheetProps) {
  const t = useTranslations("common");
  const { formatLocale, timeZone } = useFormatSettings();
  // The sheet is a decision of its own: it opens on the value it was given and reports only on Done,
  // and the opener remounts it on every open so that a cancelled edit leaves nothing behind.
  const [draft, setDraft] = useState(value);

  const twelve = uses12Hour(formatLocale);
  const { hour, minute } = partsOf(draft);
  const minutes = snap(minute);
  const set = (nextHour: number, nextMinute: number) => {
    setDraft(`${pad(nextHour)}:${pad(nextMinute)}`);
  };

  const hourOptions = twelve
    ? Array.from({ length: 12 }, (_, index) => {
        const shown = index === 0 ? 12 : index;
        return { value: String(index), label: String(shown) };
      })
    : Array.from({ length: 24 }, (_, index) => ({ value: String(index), label: pad(index) }));
  const selectedHour = twelve ? String(hour % 12) : String(hour);

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
        <div className="flex gap-2 rounded-md bg-surface-2 p-1">
          <Column
            label={t("hours")}
            options={hourOptions}
            value={selectedHour}
            onSelect={(next) => {
              const picked = Number(next);
              set(twelve ? picked + (hour >= 12 ? 12 : 0) : picked, minutes);
            }}
          />
          <Column
            label={t("minutes")}
            options={Array.from({ length: 60 / MINUTE_STEP }, (_, index) => ({
              value: String(index * MINUTE_STEP),
              label: pad(index * MINUTE_STEP),
            }))}
            value={String(minutes)}
            onSelect={(next) => {
              set(hour, Number(next));
            }}
          />
          {twelve && (
            <Column
              label={t("dayPeriod")}
              options={[
                { value: "am", label: t("am") },
                { value: "pm", label: t("pm") },
              ]}
              value={hour >= 12 ? "pm" : "am"}
              onSelect={(next) => {
                set(next === "pm" ? (hour % 12) + 12 : hour % 12, minutes);
              }}
            />
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setDraft(now);
          }}
        >
          {t("now")}
        </Button>
        <p className="text-sm text-text-3">{t("savedInZone", { zone: timeZone })}</p>
      </div>
    </Sheet>
  );
}
