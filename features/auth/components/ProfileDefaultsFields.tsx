"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LanguageChoiceSheet, useDetectedLocale } from "@/components/shell/LanguageChoice";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Field } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { Tile } from "@/components/ui/Tile";
import { TimeZonePicker } from "@/components/ui/TimeZonePicker";
import type { AppLocale } from "@/lib/i18n/routing";
import { iconProps } from "@/lib/icons/sizes";

interface ProfileDefaultsFieldsProps {
  locale: AppLocale;
  languageHelp?: boolean;
  currency: string;
  onCurrencyChange: (code: string) => void;
  currencyError?: string;
  timezone: string;
  onTimezoneChange: (zone: string) => void;
  timezoneError?: string;
}

export function ProfileDefaultsFields({
  locale,
  languageHelp = false,
  currency,
  onCurrencyChange,
  currencyError,
  timezone,
  onTimezoneChange,
  timezoneError,
}: ProfileDefaultsFieldsProps) {
  const t = useTranslations();
  const detected = useDetectedLocale();
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <>
      <Field
        label={t("auth.register.language")}
        help={languageHelp ? t("auth.register.languageHelp") : undefined}
      >
        {/* F-02: the same value as the chip — the `locale` the account is created with. */}
        <Picker
          label={
            detected === locale ? t("auth.register.languageDetected") : t("auth.register.language")
          }
          value={t(`settings.language.${locale}`)}
          onClick={() => {
            setLanguageOpen(true);
          }}
          leading={
            <Tile size="sm" color="TEAL">
              <Globe {...iconProps("sm")} />
            </Tile>
          }
        />
      </Field>
      <Field
        label={t("auth.register.currency")}
        help={t("auth.register.currencyHelp")}
        error={currencyError}
      >
        <CurrencyPicker
          value={currency || null}
          onChange={onCurrencyChange}
          label={t("auth.register.currency")}
          hint={t("auth.register.currencyDetected")}
        />
      </Field>
      <Field label={t("auth.register.timeZone")} error={timezoneError}>
        <TimeZonePicker
          value={timezone || null}
          onChange={onTimezoneChange}
          label={t("auth.register.timeZone")}
          hint={t("auth.register.timeZoneDetected")}
        />
      </Field>
      <LanguageChoiceSheet
        open={languageOpen}
        onClose={() => {
          setLanguageOpen(false);
        }}
      />
    </>
  );
}
