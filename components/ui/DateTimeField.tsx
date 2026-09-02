"use client";

import { Calendar, Clock } from "lucide-react";

import type { DateTimeParts } from "@/lib/format/dates";
import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";
import { Field, Input } from "./Field";

export type DateTimeValue = DateTimeParts;

export interface DateTimeFieldProps {
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  dateLabel: string;
  timeLabel: string;
  min?: string;
  max?: string;
  dateError?: string;
  disabled?: boolean;
  className?: string;
}

// Date and time are the only pickers allowed to use native controls (HANDOFF §3.5).
export function DateTimeField({
  value,
  onChange,
  dateLabel,
  timeLabel,
  min,
  max,
  dateError,
  disabled = false,
  className,
}: DateTimeFieldProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <Field label={dateLabel} error={dateError}>
        <Input
          type="date"
          required
          value={value.date}
          min={min}
          max={max}
          disabled={disabled}
          leading={<Calendar {...iconProps("sm")} />}
          onChange={(event) => {
            if (event.target.value) onChange({ ...value, date: event.target.value });
          }}
        />
      </Field>
      <Field label={timeLabel} optional>
        <Input
          type="time"
          value={value.time ?? ""}
          disabled={disabled}
          leading={<Clock {...iconProps("sm")} />}
          onChange={(event) => {
            onChange({ ...value, time: event.target.value || null });
          }}
        />
      </Field>
    </div>
  );
}
