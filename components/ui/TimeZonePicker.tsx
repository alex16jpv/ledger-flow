"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Picker } from "@/components/ui/Picker";
import { type PickerOption, PickerSheet } from "@/components/ui/PickerSheet";
import { Tile } from "@/components/ui/Tile";
import { listTimeZones, timeZoneCity, timeZoneOffsetLabel } from "@/lib/format/timezone";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { iconProps } from "@/lib/icons/sizes";

interface TimeZonePickerProps {
  value: string | null;
  onChange: (zone: string) => void;
  label: string;
  hint: string;
}

export function TimeZonePicker({ value, onChange, label, hint }: TimeZonePickerProps) {
  const t = useTranslations("auth.register");
  const { formatLocale } = useFormatSettings();
  const [open, setOpen] = useState(false);
  const options = useMemo<PickerOption<string>[]>(
    () =>
      listTimeZones().map((zone) => ({
        value: zone,
        label: zone,
        description: `${timeZoneCity(zone)} · ${timeZoneOffsetLabel(zone, formatLocale)}`,
      })),
    [formatLocale],
  );
  return (
    <>
      <Picker
        label={hint}
        value={value ? `${value} · ${timeZoneOffsetLabel(value, formatLocale)}` : undefined}
        placeholder={label}
        onClick={() => {
          setOpen(true);
        }}
        leading={
          <Tile size="sm" color="BLUE">
            <Globe {...iconProps("sm")} />
          </Tile>
        }
      />
      <PickerSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={t("timeZonePicker")}
        options={options}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}
