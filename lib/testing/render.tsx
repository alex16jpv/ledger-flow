import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { renderToString } from "react-dom/server";

import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import en from "@/messages/en.json";

interface ProviderOptions {
  locale?: "en" | "es";
  currency?: string;
  timeZone?: string;
}

interface Options extends ProviderOptions, Omit<RenderOptions, "wrapper"> {}

function providers({
  locale = "en",
  currency = "COP",
  timeZone = "America/Bogota",
}: ProviderOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={en} timeZone={timeZone}>
        <FormatSettingsProvider currency={currency} timeZone={timeZone}>
          {children}
        </FormatSettingsProvider>
      </NextIntlClientProvider>
    );
  };
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { locale, currency, timeZone, ...rest } = options;
  return render(ui, { wrapper: providers({ locale, currency, timeZone }), ...rest });
}

export function renderOnServer(ui: ReactElement, options: ProviderOptions = {}): string {
  const Wrapper = providers(options);
  return renderToString(<Wrapper>{ui}</Wrapper>);
}
