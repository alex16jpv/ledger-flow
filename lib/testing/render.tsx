import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import en from "@/messages/en.json";

interface Options extends Omit<RenderOptions, "wrapper"> {
  locale?: "en" | "es";
  currency?: string;
  timeZone?: string;
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { locale = "en", currency = "COP", timeZone = "America/Bogota", ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={en} timeZone={timeZone}>
        <FormatSettingsProvider currency={currency} timeZone={timeZone}>
          {children}
        </FormatSettingsProvider>
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
