"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { pathOnly } from "@/lib/observability/scrub";

// Same rule as lib/flags without importing it: env.ts would pull Zod into the static landing page.
const isProduction =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_ENV !== "test";

// Cookie-less page views and Web Vitals, production only; query strings (search filters) never leave the app.
export function Analytics() {
  if (!isProduction) return null;
  return (
    <>
      <VercelAnalytics beforeSend={(event) => ({ ...event, url: pathOnly(event.url) ?? "" })} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: pathOnly(data.url) ?? "" })} />
    </>
  );
}
