import { z } from "zod";

import { setErrorReporter } from "@/lib/observability/reporter";
import { sentryOptions } from "@/lib/observability/sentry-options";

// F-67: Zod probes for `new Function("")` the first time it compiles a schema, to decide whether it
// can JIT its validators. The throw is caught, but a strict CSP reports it as a violation first —
// every page load filed one, 229 in a single e2e run. `jitless` skips the probe and takes the
// interpreted path, which is what a CSP without `unsafe-eval` leaves it anyway.
z.config({ jitless: true });

// The SDK loads only when a DSN exists and off the critical path; errors thrown before it arrives are
// lost, a trade accepted to keep the app shell light and the e2e build SDK-free.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      ...sentryOptions(),
      integrations: [Sentry.breadcrumbsIntegration({ console: false })],
    });
    setErrorReporter((error, report) => {
      Sentry.captureException(error, {
        tags: { scope: report.scope, request_id: report.requestId ?? "none" },
      });
    });
  });
}

// Navigation tracing is off (tracesSampleRate 0); the export only keeps the SDK from warning at build time.
export const onRouterTransitionStart = (): void => undefined;
