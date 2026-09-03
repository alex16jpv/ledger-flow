import { setErrorReporter } from "@/lib/observability/reporter";
import { sentryOptions } from "@/lib/observability/sentry-options";

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
