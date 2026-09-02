import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { env } from "@/lib/env";
import en from "@/messages/en.json";

import { type AppLocale, routing } from "./routing";

type Messages = typeof en;

async function loadMessages(locale: AppLocale): Promise<Messages> {
  if (locale === "en") return en;
  const loaded = (await import(`@/messages/${locale}.json`)) as { default: Messages };
  return loaded.default;
}

function fallbackFrom(path: string): string {
  const found = path.split(".").reduce<unknown>((node, part) => {
    return node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  }, en);
  return typeof found === "string" ? found : path;
}

export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await rootParams.locale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "America/Bogota",
    onError(error) {
      if (env.NODE_ENV === "development") console.warn(error.message);
    },
    getMessageFallback({ key, namespace }) {
      return fallbackFrom([namespace, key].filter(Boolean).join("."));
    },
  };
});
