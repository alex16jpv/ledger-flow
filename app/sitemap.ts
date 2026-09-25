import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/routing";
import { INDEXED_PATHS, publicLanguages, publicUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: publicUrl(path, locale),
      alternates: { languages: publicLanguages(path) },
    })),
  );
}
