import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

// Only the public surface is indexable; the app, the BFF and the dev screens never are.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/es",
          "/privacy",
          "/es/privacy",
          "/terms",
          "/es/terms",
          "/login",
          "/register",
        ],
        disallow: [
          "/api/",
          "/home",
          "/transactions",
          "/accounts",
          "/categories",
          "/budgets",
          "/stats",
          "/settings",
          "/onboarding",
          "/dev/",
          "/es/home",
          "/es/transactions",
          "/es/accounts",
          "/es/categories",
          "/es/budgets",
          "/es/stats",
          "/es/settings",
          "/es/onboarding",
          "/es/dev/",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
