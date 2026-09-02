import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { SESSION_COOKIE } from "@/lib/auth/cookies";
import {
  APP_HOME_PATH,
  isGuestOnlyPath,
  isPublicPath,
  LOGIN_PATH,
  safeNextPath,
  stripLocale,
} from "@/lib/auth/routes";
import { routing } from "@/lib/i18n/routing";
import { buildCsp, cspHeaderName, newNonce } from "@/lib/security/csp";

const intl = createMiddleware(routing);
const CSP_REPORT_ONLY = true;

function localePrefix(pathname: string): string {
  const [, first] = pathname.split("/");
  return first &&
    (routing.locales as readonly string[]).includes(first) &&
    first !== routing.defaultLocale
    ? `/${first}`
    : "";
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const prefix = localePrefix(pathname);
  const path = stripLocale(pathname, routing.locales);
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${LOGIN_PATH}`;
    url.search = `?next=${encodeURIComponent(`${path}${search}`)}`;
    return NextResponse.redirect(url);
  }
  if (hasSession && isGuestOnlyPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${safeNextPath(request.nextUrl.searchParams.get("next"), APP_HOME_PATH)}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    reportOnly: CSP_REPORT_ONLY,
    reportUri: "/api/csp-report",
  });
  const headerName = cspHeaderName(CSP_REPORT_ONLY);
  request.headers.set(headerName, csp);
  request.headers.set("x-nonce", nonce);

  const response = intl(request);
  response.headers.set(headerName, csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
