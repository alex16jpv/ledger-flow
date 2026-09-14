import { releaseName } from "./release";

// Events leave through /monitoring so connect-src stays 'self'; maps need SENTRY_AUTH_TOKEN.
export const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  release: { name: releaseName() },
};
