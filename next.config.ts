import "./lib/env";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { HSTS_HEADER, staticSecurityHeaders } from "./lib/security/csp";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [...staticSecurityHeaders(!isProduction), ...(isProduction ? [HSTS_HEADER] : [])],
      },
    ]);
  },
};

// Events leave through /monitoring on this origin: CSP keeps connect-src 'self' and ad blockers stay out of it.
// Source maps upload only when SENTRY_AUTH_TOKEN is present (the deploy pipeline); local builds skip it.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
