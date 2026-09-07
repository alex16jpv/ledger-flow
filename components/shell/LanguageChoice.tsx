"use client";

import { CircleCheck, Globe } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Chip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { type AppLocale, routing } from "@/lib/i18n/routing";
import { useDeviceDefaults } from "@/lib/i18n/useDeviceDefaults";
import { iconProps } from "@/lib/icons/sizes";

// F-02: the screen can be read in the user's language before there is an account to store one in.
// Switching navigates to the same page in the other language — the account is created from the URL's
// locale, so what the user chose here is what `locale` carries and what the app opens in afterwards.
export function useLocaleSwitch(): (locale: AppLocale) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (locale: AppLocale) => {
      // `?reauth=1&next=…` is what gets a device with a live marker to the login (§2.6): the language
      // must not be the thing that drops it.
      router.replace({ pathname, query: Object.fromEntries(params) }, { locale });
    },
    [router, pathname, params],
  );
}

// What the device asked for, when it is one of ours. It is a hint on the row, never a third value.
export function useDetectedLocale(): AppLocale | null {
  const defaults = useDeviceDefaults();
  const language = defaults?.language.split("-")[0];
  return routing.locales.find((locale) => locale === language) ?? null;
}

export function LanguageChoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const detected = useDetectedLocale();
  const switchTo = useLocaleSwitch();

  return (
    <Sheet open={open} onClose={onClose} title={t("settings.language.title")}>
      <List className="-mx-4">
        <div role="listbox" aria-label={t("settings.language.title")} className="flex flex-col">
          {routing.locales.map((option) => {
            const selected = option === locale;
            return (
              <RowButton
                key={option}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  if (!selected) switchTo(option);
                  onClose();
                }}
                className={cn("border-t border-border", selected && "bg-brand-soft/40")}
              >
                <RowBody>
                  <RowTitle>
                    <span>{t(`settings.language.${option}`)}</span>
                  </RowTitle>
                  {option === detected && <RowMeta items={[t("auth.register.languageDetected")]} />}
                </RowBody>
                {selected && (
                  <RowRight>
                    <CircleCheck {...iconProps("md")} className="text-brand" />
                  </RowRight>
                )}
              </RowButton>
            );
          })}
        </div>
      </List>
      <p className="pt-3 text-sm text-text-3">{t("auth.register.languageNote")}</p>
    </Sheet>
  );
}

// The chip of §8.4, to the right of the brand: the same choice as the row of the register form, so
// changing either changes the other.
export function LanguageChip() {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Chip
        aria-label={t("settings.language.title")}
        icon={<Globe {...iconProps("sm")} />}
        onClick={() => {
          setOpen(true);
        }}
      >
        {locale.toUpperCase()}
      </Chip>
      <LanguageChoiceSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
