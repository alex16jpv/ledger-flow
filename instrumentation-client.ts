import { setErrorReporter } from "@/lib/observability/reporter";
import { sentryOptions } from "@/lib/observability/sentry-options";

// The SDK loads off the critical path, so errors thrown before it arrives are lost.
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
