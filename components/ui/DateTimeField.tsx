"use client";

import { Calendar, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import {
  type DateTimeParts,
  dateTimeParts,
  dayKey,
  localDateTime,
  localNoon,
  shiftDayKey,
} from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";
import { DatePickerSheet } from "./DatePickerSheet";
import { Field, INPUT, useFieldContext } from "./Field";
import { TimePickerSheet } from "./TimePickerSheet";

export type DateTimeValue = DateTimeParts;

// The control that opens a sheet, drawn as the input it replaces (§8.2, preview B): a leading icon
// and the value, never the browser's own widget (F-05).
function Opener({
  leading,
  value,
  disabled,
  invalid,
  describedBy,
  id,
  onClick,
}: {
  leading: ReactNode;
  value: string;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  id?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      aria-describedby={describedBy}
      // A button has no validity of its own, so the error is announced by the field's description.
      disabled={disabled}
      onClick={onClick}
      className={cn(INPUT, "text-left", invalid && "border-danger-solid")}
    >
      <span className="text-text-3">{leading}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </button>
  );
}

function DateOpener({
  value,
  onChange,
  label,
  error,
  disabled,
  min,
  max,
  note,
}: {
  value: string;
  onChange: (day: string) => void;
  label: string;
  error?: string;
  disabled: boolean;
  min?: string;
  max?: string;
  note?: string;
}) {
  const t = useTranslations("common");
  const dates = useDates();
  const { timeZone } = useFormatSettings();
  const [open, setOpen] = useState(0);
  const today = dayKey(new Date(), timeZone);
  const shown =
    value === today
      ? t("today")
      : value === shiftDayKey(today, -1)
        ? t("yesterday")
        : dates.formatDay(localNoon(value, timeZone));

  return (
    <>
      <Field label={label} error={error}>
        <FieldOpener
          leading={<Calendar {...iconProps("sm")} />}
          value={shown}
          disabled={disabled}
          invalid={Boolean(error)}
          onClick={() => {
            setOpen((count) => count + 1);
          }}
        />
      </Field>
      <DatePickerSheet
        key={open}
        open={open > 0}
        value={value}
        min={min}
        max={max}
        note={note}
        today={today}
        title={label}
        onChange={onChange}
        onClose={() => {
          setOpen(0);
        }}
      />
    </>
  );
}

// `Field` owns the id and the description, and only a child that reads its context gets them.
function FieldOpener(props: Omit<Parameters<typeof Opener>[0], "id" | "describedBy">) {
  const field = useFieldContext();
  return <Opener {...props} id={field?.id} describedBy={field?.describedBy} />;
}

export interface DateFieldProps {
  value: string;
  onChange: (day: string) => void;
  label: string;
  error?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  note?: string;
}

// Standalone: the range of the filters sheet (§8.5) and the budget's dates (§8.8) ask for a day and
// nothing else.
export function DateField({ disabled = false, ...rest }: DateFieldProps) {
  return <DateOpener disabled={disabled} {...rest} />;
}

export interface DateTimeFieldProps {
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  dateLabel: string;
  timeLabel: string;
  min?: string;
  max?: string;
  dateNote?: string;
  dateError?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimeField({
  value,
  onChange,
  dateLabel,
  timeLabel,
  min,
  max,
  dateNote,
  dateError,
  disabled = false,
  className,
}: DateTimeFieldProps) {
  const dates = useDates();
  const { timeZone } = useFormatSettings();
  const [openTime, setOpenTime] = useState(0);
  const now = dateTimeParts(new Date(), timeZone);
  const time = value.time ?? now.time;

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <DateOpener
        value={value.date}
        onChange={(date) => {
          onChange({ ...value, date });
        }}
        label={dateLabel}
        error={dateError}
        disabled={disabled}
        min={min}
        max={max}
        note={dateNote}
      />
      <Field label={timeLabel} optional>
        <FieldOpener
          leading={<Clock {...iconProps("sm")} />}
          value={dates.formatTime(localDateTime(value.date, time, timeZone))}
          disabled={disabled}
          invalid={false}
          onClick={() => {
            setOpenTime((count) => count + 1);
          }}
        />
      </Field>
      <TimePickerSheet
        key={openTime}
        open={openTime > 0}
        value={time}
        now={now.time}
        title={timeLabel}
        onChange={(next) => {
          onChange({ ...value, time: next });
        }}
        onClose={() => {
          setOpenTime(0);
        }}
      />
    </div>
  );
}
