import "./lib/env";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { releaseName } from "./lib/observability/release";
import { sentryBuildOptions } from "./lib/observability/sentry-build";
import { HSTS_HEADER, staticSecurityHeaders } from "./lib/security/csp";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Inlined here, or the browser depends on Vercel exposing its system variables to agree with the build.
  env: { NEXT_PUBLIC_APP_VERSION: releaseName() },
  // The e2e build points this elsewhere so it never overwrites the `.next` a running app is serving (F-56).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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

export default withSentryConfig(withNextIntl(nextConfig), sentryBuildOptions);
