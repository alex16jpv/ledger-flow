import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { SESSION_COOKIE } from "@/lib/auth/cookies";
import {
  APP_HOME_PATH,
  isGuestOnlyPath,
  isProtectedPath,
  LOGIN_PATH,
  REAUTH_PARAM,
  safeNextPath,
  stripLocale,
} from "@/lib/auth/routes";
import { routing } from "@/lib/i18n/routing";
import { buildCsp, cspHeaderName, newNonce } from "@/lib/security/csp";

const intl = createMiddleware(routing);
const CSP_REPORT_ONLY = false;
const LOOPBACK_HOST = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/;

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
  // The marker says this device holds a vault, not that the session is alive (§2.6): it is what
  // lets `(app)` open with a dead refresh, and it is never proof of anything else.
  const hasMarker = request.cookies.has(SESSION_COOKIE);
  // ...which is why it cannot bounce anyone off the login: with a 400-day marker and a dead session
  // that would be a device locked out of its own account.
  const reauthenticating = request.nextUrl.searchParams.has(REAUTH_PARAM);

  // Previews must never be indexed, whatever the path (Vercel only adds the header on *.vercel.app).
  const noindex =
    isProtectedPath(path) ||
    path.startsWith("/dev/") ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  if (!hasMarker && isProtectedPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${LOGIN_PATH}`;
    url.search = `?next=${encodeURIComponent(`${path}${search}`)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-robots-tag", "noindex, nofollow");
    return redirect;
  }
  if (hasMarker && !reauthenticating && isGuestOnlyPath(path)) {
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
    loopback: request.nextUrl.protocol === "http:" && LOOPBACK_HOST.test(request.nextUrl.hostname),
  });
  const headerName = cspHeaderName(CSP_REPORT_ONLY);
  request.headers.set(headerName, csp);
  request.headers.set("x-nonce", nonce);

  const response = intl(request);
  response.headers.set(headerName, csp);
  if (noindex) response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|monitoring|icon|apple-icon|.*\\..*).*)"],
};
