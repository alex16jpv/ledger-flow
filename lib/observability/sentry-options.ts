import { scrubBreadcrumb, scrubEvent } from "./scrub";

// Reads process.env directly: importing lib/env would drag Zod into the runtime chunk of every page.
// Errors only: Web Vitals go to Speed Insights, so the free plan quota is spent on what needs a fix.
export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Same fallback `lib/env.ts` gives Settings › About: without it every deploy reports as `dev`
    // and no fix can be told apart from the build before it (H-21).
    release:
      process.env.NEXT_PUBLIC_APP_VERSION ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      "dev",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
