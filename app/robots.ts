import type { MetadataRoute } from "next";

import { APP_PREFIXES } from "@/lib/auth/routes";
import { env } from "@/lib/env";
import { localePrefix, LOCALES } from "@/lib/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/seo";

const inEveryLocale = (paths: readonly string[]) =>
  LOCALES.flatMap((locale) =>
    paths.map((path) =>
      path === "/" ? localePrefix(locale) || "/" : `${localePrefix(locale)}${path}`,
    ),
  );

// Only the public surface is indexable; the app, the BFF and the dev screens never are.
export default function robots(): MetadataRoute.Robots {
  if (env.NEXT_PUBLIC_VERCEL_ENV === "preview")
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: inEveryLocale(PUBLIC_PATHS),
        disallow: ["/api/", ...inEveryLocale(["/dev/", ...APP_PREFIXES])],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
