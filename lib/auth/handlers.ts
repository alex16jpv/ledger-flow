import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, BackendUnavailableError, readBackendJson } from "@/lib/api/backend";
import { clientIpOf } from "@/lib/api/client-ip";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import { env } from "@/lib/env";
import { LOCALE_COOKIE } from "@/lib/i18n/routing";
import type {
  AuthTokens,
  EmailChangeConfirmed,
  ErrorResponse,
  PasswordResetDone,
  SignUpStarted,
  User,
} from "@/types/api";

import {
  ACCESS_COOKIE,
  type CookieSpec,
  DEVICE_COOKIE,
  deviceCookie,
  expiredAuthCookies,
  expiredSessionCookies,
  localeCookie,
  REFRESH_COOKIE,
  sessionCookies,
} from "./cookies";
import { decodeAccessToken } from "./jwt";
import { isTrustedOrigin } from "./origin";
import {
  expiredSignUpCookie,
  parseSignUpCookie,
  type PendingSignUp,
  SIGN_UP_COOKIE,
  signUpCookie,
} from "./sign-up-cookie";

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
  extra: Record<string, unknown> = {},
): NextResponse {
  const response = NextResponse.json(user ? { user, ...extra } : extra, { status });
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

const isFields = (body: unknown): body is Record<string, unknown> =>
  typeof body === "object" && body !== null && !Array.isArray(body);

function withDeviceToken(body: unknown, deviceToken: string | undefined): unknown {
  if (!isFields(body)) return body;
  const fields: Record<string, unknown> = { ...body };
  delete fields.deviceToken;
  return deviceToken ? { ...fields, deviceToken } : fields;
}

// Only a link carries the refresh token, and only the cookie's: a body cannot name another session.
function withRefreshToken(body: unknown, refreshToken: string | undefined): unknown {
  if (!isFields(body)) return body;
  const fields: Record<string, unknown> = { ...body };
  delete fields.refreshToken;
  return refreshToken && "token" in fields ? { ...fields, refreshToken } : fields;
}

interface ForwardOptions {
  sendDeviceToken: boolean;
  sendSession?: boolean;
  sendRefreshToken?: boolean;
  fields?: Record<string, string>;
}

interface Forwarded {
  upstream: Response;
  requestId: string | null;
  body: unknown;
}

async function forwardAuthRequest(
  path: string,
  request: NextRequest,
  { sendDeviceToken, sendSession = false, sendRefreshToken = false, fields }: ForwardOptions,
): Promise<Forwarded | NextResponse> {
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
  const withFields = fields && isFields(body) ? { ...body, ...fields } : body;
  const withDevice = sendDeviceToken
    ? withDeviceToken(withFields, request.cookies.get(DEVICE_COOKIE)?.value)
    : withFields;
  const upstream = await backendFetch(path, {
    method: "POST",
    body: sendRefreshToken
      ? withRefreshToken(withDevice, request.cookies.get(REFRESH_COOKIE)?.value)
      : withDevice,
    accessToken: sendSession ? request.cookies.get(ACCESS_COOKIE)?.value : undefined,
    requestId,
    clientIp: clientIpOf(request),
    userAgent: request.headers.get("user-agent"),
  });
  return { upstream, requestId, body };
}

function emptyAnswer(path: string): NextResponse {
  return NextResponse.json(
    { error: "UpstreamError", message: `Empty answer from ${path}`, code: "INTERNAL" },
    { status: 502 },
  );
}

async function signedIn(
  path: string,
  { upstream, requestId }: Forwarded,
  extraCookies: CookieSpec[] = [],
): Promise<NextResponse> {
  const tokens = await readBackendJson<AuthTokens & Partial<Pick<PasswordResetDone, "restored">>>(
    upstream,
  );
  if (!tokens) return emptyAnswer(path);
  const extra = typeof tokens.restored === "boolean" ? { restored: tokens.restored } : {};
  const response = sessionResponse(tokens, tokens.user, upstream.status, requestId, extra);
  if (tokens.deviceToken) applyCookies(response, [deviceCookie(tokens.deviceToken)]);
  return applyCookies(response, extraCookies);
}

// The backend reads the reset's body strictly: no device token there.
export async function authenticate(
  path: "/auth/login" | "/auth/login/restore" | "/auth/password/reset",
  request: NextRequest,
): Promise<NextResponse> {
  return withBackend(async () => {
    const forwarded = await forwardAuthRequest(path, request, {
      sendDeviceToken: path !== "/auth/password/reset",
    });
    if (forwarded instanceof NextResponse) return forwarded;
    if (!forwarded.upstream.ok) return passThroughError(forwarded.upstream, forwarded.requestId);
    return signedIn(path, forwarded);
  });
}

function signUpAnswer(pending: PendingSignUp, now = Date.now()) {
  return {
    email: pending.email,
    expiresAt: new Date(pending.expiresAt).toISOString(),
    resendAfterSeconds: Math.max(0, Math.ceil((pending.resendAt - now) / 1000)),
  };
}

const noStore = { "cache-control": "no-store" };

function signUpExpired(): NextResponse {
  const response = NextResponse.json(
    { error: "Conflict", message: "This sign-up is over", code: "SIGN_UP_EXPIRED" },
    { status: 409 },
  );
  return applyCookies(response, [expiredSignUpCookie()]);
}

const typedEmail = (body: unknown): string =>
  isFields(body) && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

export function startSignUp(request: NextRequest): Promise<NextResponse> {
  return withBackend(async () => {
    const forwarded = await forwardAuthRequest("/auth/sign-up", request, { sendDeviceToken: true });
    if (forwarded instanceof NextResponse) return forwarded;
    const { upstream, requestId, body } = forwarded;
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const started = await readBackendJson<SignUpStarted>(upstream);
    if (!started) return emptyAnswer("/auth/sign-up");
    const now = Date.now();
    const pending: PendingSignUp = {
      token: started.signUpToken,
      email: typedEmail(body),
      expiresAt: Date.parse(started.expiresAt),
      resendAt: now + started.resendAfterSeconds * 1000,
    };
    const response = NextResponse.json(signUpAnswer(pending, now), {
      status: upstream.status,
      headers: noStore,
    });
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return applyCookies(response, [signUpCookie(pending, now)]);
  });
}

export function pendingSignUp(request: NextRequest): NextResponse {
  const pending = parseSignUpCookie(request.cookies.get(SIGN_UP_COOKIE)?.value);
  if (!pending) return new NextResponse(null, { status: 204, headers: noStore });
  return NextResponse.json(signUpAnswer(pending), { headers: noStore });
}

export function forgetSignUp(request: NextRequest): NextResponse {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  return applyCookies(new NextResponse(null, { status: 204 }), [expiredSignUpCookie()]);
}

export function resendSignUp(request: NextRequest): Promise<NextResponse> {
  return withBackend(async () => {
    const denied = untrustedOriginResponse(request);
    if (denied) return denied;
    const pending = parseSignUpCookie(request.cookies.get(SIGN_UP_COOKIE)?.value);
    if (!pending) return signUpExpired();
    const forwarded = await forwardAuthRequest("/auth/sign-up/resend", request, {
      sendDeviceToken: true,
      fields: { signUpToken: pending.token },
    });
    if (forwarded instanceof NextResponse) return forwarded;
    const { upstream, requestId } = forwarded;
    if (!upstream.ok) {
      const response = await passThroughError(upstream, requestId);
      return upstream.status === 409 ? applyCookies(response, [expiredSignUpCookie()]) : response;
    }
    const answer = await readBackendJson<{ resendAfterSeconds: number }>(upstream);
    if (!answer) return emptyAnswer("/auth/sign-up/resend");
    const now = Date.now();
    const resent = { ...pending, resendAt: now + answer.resendAfterSeconds * 1000 };
    const response = NextResponse.json(signUpAnswer(resent, now), {
      status: upstream.status,
      headers: noStore,
    });
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return applyCookies(response, [signUpCookie(resent, now)]);
  });
}

export function confirmSignUp(request: NextRequest): Promise<NextResponse> {
  return withBackend(async () => {
    const denied = untrustedOriginResponse(request);
    if (denied) return denied;
    const pending = parseSignUpCookie(request.cookies.get(SIGN_UP_COOKIE)?.value);
    if (!pending) {
      return NextResponse.json(
        { error: "BadRequest", message: "Invalid code", code: "SIGN_UP_CODE_INVALID" },
        { status: 400 },
      );
    }
    const forwarded = await forwardAuthRequest("/auth/sign-up/confirm", request, {
      sendDeviceToken: false,
      fields: { signUpToken: pending.token },
    });
    if (forwarded instanceof NextResponse) return forwarded;
    if (!forwarded.upstream.ok) {
      const response = await passThroughError(forwarded.upstream, forwarded.requestId);
      return forwarded.upstream.status === 409
        ? applyCookies(response, [expiredSignUpCookie()])
        : response;
    }
    return signedIn("/auth/sign-up/confirm", forwarded, [expiredSignUpCookie()]);
  });
}

export function requestPasswordReset(request: NextRequest): Promise<NextResponse> {
  return forwardWithAnswer("/auth/password/forgot", request, { sendDeviceToken: true });
}

// Resend counts this device, not its IP, and a code names its account by the session; a link needs none.
const EMAIL_FORWARDS = {
  "/auth/email/verify": { sendDeviceToken: false, sendSession: true },
  "/auth/email/resend": { sendDeviceToken: true, sendSession: true },
  "/auth/email/restore": { sendDeviceToken: false, sendSession: false },
  "/auth/email/undo": { sendDeviceToken: false, sendSession: false },
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

function noSessionResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized", message: "No session" }, { status: 401 });
}

function emailChangePath(request: NextRequest): string | null {
  const userId = decodeAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)?.userId;
  return userId ? `/users/${encodeURIComponent(userId)}/email-change` : null;
}

// Asking and Resend count this device, not its IP, and both name the account by the session.
export async function requestEmailChange(
  kind: "request" | "resend",
  request: NextRequest,
): Promise<NextResponse> {
  const path = emailChangePath(request);
  if (!path) return noSessionResponse();
  return forwardWithAnswer(kind === "resend" ? `${path}/resend` : path, request, {
    sendDeviceToken: true,
    sendSession: true,
  });
}

export async function cancelEmailChange(request: NextRequest): Promise<NextResponse> {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const path = emailChangePath(request);
  if (!path) return noSessionResponse();
  const requestId = forwardedRequestId(request);
  return withBackend(async () => {
    const upstream = await backendFetch(path, {
      method: "DELETE",
      accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
      requestId,
      clientIp: clientIpOf(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const response = NextResponse.json((await readBackendJson<unknown>(upstream)) ?? {}, {
      headers: { "cache-control": "no-store" },
    });
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  });
}

// The backend answers tokens only for a code or this browser's own session; with none, cookies stay.
export async function confirmEmailChange(request: NextRequest): Promise<NextResponse> {
  return withBackend(async () => {
    const forwarded = await forwardAuthRequest("/auth/email/confirm-change", request, {
      sendDeviceToken: false,
      sendSession: true,
      sendRefreshToken: true,
    });
    if (forwarded instanceof NextResponse) return forwarded;
    const { upstream, requestId } = forwarded;
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const answer = await readBackendJson<EmailChangeConfirmed>(upstream);
    if (!answer) {
      return NextResponse.json(
        { error: "UpstreamError", message: "Empty answer from confirm-change", code: "INTERNAL" },
        { status: 502 },
      );
    }
    const { accessToken, refreshToken, deviceToken, user } = answer;
    if (!accessToken || !refreshToken) {
      const response = NextResponse.json({}, { headers: { "cache-control": "no-store" } });
      if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }
    const response = sessionResponse({ accessToken, refreshToken }, user, 200, requestId);
    if (deviceToken) applyCookies(response, [deviceCookie(deviceToken)]);
    return response;
  });
}
