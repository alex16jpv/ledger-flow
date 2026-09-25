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
import { isEnabled } from "@/lib/flags";
import { routing } from "@/lib/i18n/routing";
import { namesUnknownRow, UNKNOWN_ROW_HEADER } from "@/lib/routing/entity-route";
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
  // §2.6: the marker says this device holds a vault, never that the session is alive.
  const hasMarker = request.cookies.has(SESSION_COOKIE);
  // …so it cannot bounce anyone off the login, or a dead session locks the device out.
  const reauthenticating = request.nextUrl.searchParams.has(REAUTH_PARAM);

  // W-39: `(app)/loading.tsx` streams before the page, so the 404 is decided here instead.
  if (path.startsWith("/dev/") && !isEnabled("componentCatalog")) {
    const gone = new NextResponse(null, { status: 404 });
    gone.headers.set("x-robots-tag", "noindex, nofollow");
    return gone;
  }

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
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), APP_HOME_PATH);
    return NextResponse.redirect(new URL(`${prefix}${next}`, request.url));
  }

  // The address cannot name a row, so the group's layout answers 404 above its own streaming boundary.
  if (namesUnknownRow(path)) request.headers.set(UNKNOWN_ROW_HEADER, "1");

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
  // An unprefixed address answers by the locale cookie and Accept-Language, so a cache must key on both.
  if (!prefix) response.headers.append("vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|monitoring|icon|apple-icon|(?:en|es)/opengraph-image$|.*\\..*).*)",
  ],
};
