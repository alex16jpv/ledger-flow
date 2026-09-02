import "./lib/env";

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

export default withNextIntl(nextConfig);
