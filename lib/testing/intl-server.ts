import { createTranslator } from "next-intl";

import en from "@/messages/en.json";
import es from "@/messages/es.json";

export type TestLocale = "en" | "es";

export function serverIntl(locale: () => TestLocale) {
  return {
    getLocale: () => Promise.resolve(locale()),
    getTranslations: (namespace: string) =>
      Promise.resolve(
        createTranslator({
          locale: locale(),
          messages: locale() === "es" ? es : en,
          namespace: namespace as never,
        }),
      ),
  };
}
