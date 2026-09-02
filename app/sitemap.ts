import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/routing";
import { PUBLIC_PATHS, publicUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: publicUrl(path, "en"),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((locale) => [locale, publicUrl(path, locale)])),
    },
  }));
}
