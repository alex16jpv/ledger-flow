import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, BackendUnavailableError, readBackendJson } from "@/lib/api/backend";
import { clientIpOf } from "@/lib/api/client-ip";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import { env } from "@/lib/env";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";
import type { AuthTokens, ErrorResponse, User } from "@/types/api";

import {
  ACCESS_COOKIE,
  type CookieSpec,
  DEVICE_COOKIE,
  deviceCookie,
  expiredAuthCookies,
  expiredSessionCookies,
  localeCookie,
  sessionCookies,
} from "./cookies";
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
  applyCookies(response, sessionCookies(tokens, user?.id));
  if (user?.locale) applyCookies(response, [localeCookie(LOCALE_COOKIE, user.locale)]);
  if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

// F-34: no `storage` here — it would take the vault; `purgeVault` applies the user's answer.
export function endSessionResponse(status = 200): NextResponse {
  const response =
    status === 204
      ? new NextResponse(null, { status })
      : NextResponse.json({ ok: true }, { status });
  applyCookies(response, expiredSessionCookies());
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}

// §2.6, invariant 7: the session is over, the vault is not — the marker stays, nothing is cleared.
export function endExpiredSessionResponse(status = 401): NextResponse {
  const response = NextResponse.json({ ok: false }, { status });
  applyCookies(response, expiredAuthCookies());
  return response;
}

function withDeviceToken(body: unknown, deviceToken: string | undefined): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  const fields: Record<string, unknown> = { ...body };
  delete fields.deviceToken;
  return deviceToken ? { ...fields, deviceToken } : fields;
}

interface ForwardOptions {
  sendDeviceToken: boolean;
  sendSession?: boolean;
}

async function forwardAuthRequest(
  path: string,
  request: NextRequest,
  { sendDeviceToken, sendSession = false }: ForwardOptions,
): Promise<{ upstream: Response; requestId: string | null } | NextResponse> {
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
    body: sendDeviceToken ? withDeviceToken(body, request.cookies.get(DEVICE_COOKIE)?.value) : body,
    accessToken: sendSession ? request.cookies.get(ACCESS_COOKIE)?.value : undefined,
    requestId,
    clientIp: clientIpOf(request),
    userAgent: request.headers.get("user-agent"),
  });
  return { upstream, requestId };
}

// The backend reads the reset's body strictly: no device token there.
export async function authenticate(
  path: "/auth/login" | "/auth/register" | "/auth/password/reset",
  request: NextRequest,
): Promise<NextResponse> {
  return withBackend(async () => {
    const forwarded = await forwardAuthRequest(path, request, {
      sendDeviceToken: path !== "/auth/password/reset",
    });
    if (forwarded instanceof NextResponse) return forwarded;
    const { upstream, requestId } = forwarded;
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const tokens = await readBackendJson<AuthTokens>(upstream);
    if (!tokens) {
      return NextResponse.json(
        { error: "UpstreamError", message: "Empty auth response", code: "INTERNAL" },
        { status: 502 },
      );
    }
    const response = sessionResponse(tokens, tokens.user, upstream.status, requestId);
    if (tokens.deviceToken) applyCookies(response, [deviceCookie(tokens.deviceToken)]);
    return response;
  });
}

export function requestPasswordReset(request: NextRequest): Promise<NextResponse> {
  return forwardWithAnswer("/auth/password/forgot", request, { sendDeviceToken: true });
}

// Resend counts this device, not its IP, and a code names its account by the session; a link needs none.
const EMAIL_FORWARDS = {
  "/auth/email/verify": { sendDeviceToken: false, sendSession: true },
  "/auth/email/resend": { sendDeviceToken: true, sendSession: true },
  "/auth/email/not-me": { sendDeviceToken: false, sendSession: false },
} as const satisfies Record<string, ForwardOptions>;

export function confirmEmail(
  path: keyof typeof EMAIL_FORWARDS,
  request: NextRequest,
): Promise<NextResponse> {
  return forwardWithAnswer(path, request, EMAIL_FORWARDS[path]);
}

async function forwardWithAnswer(
  path: string,
  request: NextRequest,
  options: ForwardOptions,
): Promise<NextResponse> {
  return withBackend(async () => {
    const forwarded = await forwardAuthRequest(path, request, options);
    if (forwarded instanceof NextResponse) return forwarded;
    const { upstream, requestId } = forwarded;
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const answer = await readBackendJson<unknown>(upstream);
    if (!answer) {
      return NextResponse.json(
        { error: "UpstreamError", message: `Empty answer from ${path}`, code: "INTERNAL" },
        { status: 502 },
      );
    }
    const response = NextResponse.json(answer, {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    });
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  });
}
