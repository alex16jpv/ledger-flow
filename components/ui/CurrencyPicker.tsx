"use client";

import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Picker } from "@/components/ui/Picker";
import { type PickerOption, PickerSheet } from "@/components/ui/PickerSheet";
import { Tile } from "@/components/ui/Tile";
import { currencyName, listCurrencies } from "@/lib/format/currency";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { iconProps } from "@/lib/icons/sizes";

interface CurrencyPickerProps {
  value: string | null;
  onChange: (code: string) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}

export function CurrencyPicker({
  value,
  onChange,
  label,
  hint,
  disabled = false,
}: CurrencyPickerProps) {
  const t = useTranslations("auth.register");
  const { formatLocale } = useFormatSettings();
  const [open, setOpen] = useState(false);
  const options = useMemo<PickerOption<string>[]>(
    () =>
      listCurrencies().map((code) => ({
        value: code,
        label: `${code} · ${currencyName(code, formatLocale)}`,
      })),
    [formatLocale],
  );
  return (
    <>
      <Picker
        label={hint}
        value={value ? `${value} · ${currencyName(value, formatLocale)}` : undefined}
        placeholder={label}
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
        leading={
          <Tile size="sm" color="GREEN">
            <Coins {...iconProps("sm")} />
          </Tile>
        }
      />
      <PickerSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={t("currencyPicker")}
        options={options}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}
