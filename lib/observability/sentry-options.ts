import { scrubBreadcrumb, scrubEvent } from "./scrub";

// Reads process.env directly: importing lib/env would drag Zod into the runtime chunk of every page.
// Errors only: Web Vitals go to Speed Insights, so the free plan quota is spent on what needs a fix.
export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
