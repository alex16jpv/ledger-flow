import "server-only";

import { NextResponse } from "next/server";

import { backendFetch, BackendUnavailableError, readBackendJson } from "@/lib/api/backend";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import { env } from "@/lib/env";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";
import type { AuthTokens, ErrorResponse, User } from "@/types/api";

import { type CookieSpec, expiredSessionCookies, localeCookie, sessionCookies } from "./cookies";
import { isTrustedOrigin } from "./origin";

export const AUTH_JSON_LIMIT_BYTES = 10_000;

export function untrustedOriginResponse(request: Request): NextResponse | null {
  if (isTrustedOrigin(request, env.NEXT_PUBLIC_APP_URL)) return null;
  return NextResponse.json(
    { error: "Forbidden", message: "Untrusted origin", code: "UNTRUSTED_ORIGIN" },
    { status: 403 },
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length === 0) return undefined;
  if (text.length > AUTH_JSON_LIMIT_BYTES) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function applyCookies(response: NextResponse, cookies: CookieSpec[]): NextResponse {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    });
  }
  return response;
}

export function forwardedRequestId(request: Request): string | null {
  return request.headers.get(REQUEST_ID_HEADER);
}

export async function passThroughError(
  upstream: Response,
  requestId: string | null,
): Promise<NextResponse> {
  const body = (await readBackendJson<ErrorResponse>(upstream)) ?? {
    error: "UpstreamError",
    message: upstream.statusText || "Upstream error",
  };
  const response = NextResponse.json(body, { status: upstream.status });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function unavailableResponse(error: unknown): NextResponse {
  const timedOut = error instanceof BackendUnavailableError && error.timedOut;
  return NextResponse.json(
    {
      error: "ServiceUnavailable",
      message: timedOut ? "Backend timed out" : "Backend unreachable",
      code: "DB_UNAVAILABLE",
    },
    { status: timedOut ? 504 : 503 },
  );
}

export async function withBackend(run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BackendUnavailableError) return unavailableResponse(error);
    throw error;
  }
}

export function sessionResponse(
  tokens: AuthTokens,
  user: User | undefined,
  status: number,
  requestId: string | null,
): NextResponse {
  const response = NextResponse.json(user ? { user } : {}, { status });
  applyCookies(response, sessionCookies(tokens));
  if (user?.locale) applyCookies(response, [localeCookie(LOCALE_COOKIE, user.locale)]);
  if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function endSessionResponse(status = 200): NextResponse {
  const response =
    status === 204
      ? new NextResponse(null, { status })
      : NextResponse.json({ ok: true }, { status });
  applyCookies(response, expiredSessionCookies());
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}

export async function authenticate(
  path: "/auth/login" | "/auth/register",
  request: Request,
): Promise<NextResponse> {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const body = await readJsonBody(request);
  if (body === undefined) {
    return NextResponse.json(
      { error: "BadRequest", message: "Invalid JSON body", code: "VALIDATION" },
      { status: 400 },
    );
  }
  const requestId = forwardedRequestId(request);
  const upstream = await backendFetch(path, {
    method: "POST",
    body,
    requestId,
    userAgent: request.headers.get("user-agent"),
  });
  if (!upstream.ok) return passThroughError(upstream, requestId);
  const tokens = await readBackendJson<AuthTokens>(upstream);
  if (!tokens) {
    return NextResponse.json(
      { error: "UpstreamError", message: "Empty auth response", code: "INTERNAL" },
      { status: 502 },
    );
  }
  return sessionResponse(tokens, tokens.user, upstream.status, requestId);
}
