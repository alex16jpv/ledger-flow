"use client";

import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { List, RowBody, RowButton, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import {
  deviceLocale,
  type LocaleMode,
  readLocaleMode,
  writeLocaleMode,
} from "@/lib/i18n/locale-preference";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { type AppLocale, LOCALES } from "@/lib/i18n/routing";
import { iconProps } from "@/lib/icons/sizes";

import { useUpdateLocale } from "../hooks";

interface LanguageSheetProps {
  open: boolean;
  onClose: () => void;
}

type Choice = "device" | AppLocale;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function LanguageSheet({ open, onClose }: LanguageSheetProps) {
  const t = useTranslations("settings.language");
  const current = useLocale();
  const { currency } = useFormatSettings();
  const router = useRouter();
  const pathname = usePathname();
  const update = useUpdateLocale();
  const mode: LocaleMode = readLocaleMode(storage());
  const selected: Choice = mode === "device" ? "device" : current;

  async function choose(choice: Choice) {
    const nextMode: LocaleMode = choice === "device" ? "device" : "fixed";
    const locale = choice === "device" ? deviceLocale(navigator.language) : choice;
    writeLocaleMode(storage(), nextMode);
    if (locale !== current) {
      await update.mutateAsync(locale);
      router.replace(pathname, { locale });
    }
    onClose();
  }

  const options: { value: Choice; title: string; meta: string }[] = [
    { value: "device", title: t("followDevice"), meta: t("followDeviceHelp") },
    ...LOCALES.map((locale) => ({
      value: locale,
      title: t(locale),
      meta: locale === "en" ? t("default") : t("esHelp"),
    })),
  ];

  return (
    <Sheet open={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-4">
        <List className="-mx-4" role="listbox" aria-label={t("title")}>
          {options.map((option) => (
            <RowButton
              key={option.value}
              role="option"
              aria-selected={selected === option.value}
              disabled={update.isPending}
              onClick={() => {
                void choose(option.value);
              }}
              className="border-t border-border first:border-t-0"
            >
              <RowBody>
                <RowTitle>
                  <span>{option.title}</span>
                </RowTitle>
                <RowMeta items={[option.meta]} />
              </RowBody>
              {selected === option.value && (
                <CircleCheck {...iconProps("sm")} className="text-brand-text" />
              )}
            </RowButton>
          ))}
        </List>
        <p className="text-sm text-text-2">{t("note", { currency })}</p>
      </div>
    </Sheet>
  );
}
