import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, readBackendJson } from "@/lib/api/backend";
import { clientIpOf } from "@/lib/api/client-ip";
import {
  parseSessionMarker,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  sessionMarkerCookie,
} from "@/lib/auth/cookies";
import {
  applyCookies,
  endExpiredSessionResponse,
  forwardedRequestId,
  passThroughError,
  sessionResponse,
  untrustedOriginResponse,
  withBackend,
} from "@/lib/auth/handlers";
import { decodeAccessToken } from "@/lib/auth/jwt";
import { isSessionVerdict, SESSION_END_HEADER } from "@/lib/auth/session-end";
import type { AuthTokens } from "@/types/api";

export async function POST(request: NextRequest) {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const response = endExpiredSessionResponse();
    response.headers.set(SESSION_END_HEADER, "no-cookie");
    return NextResponse.json(
      { error: "Unauthorized", message: "No session", code: "REFRESH_INVALID" },
      { status: 401, headers: response.headers },
    );
  }
  const requestId = forwardedRequestId(request);
  return withBackend(async () => {
    const upstream = await backendFetch("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      requestId,
      clientIp: clientIpOf(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (upstream.status === 401) {
      const error = await passThroughError(upstream, requestId);
      const body = (await error
        .clone()
        .json()
        .catch(() => null)) as {
        code?: unknown;
      } | null;
      // H-10: a 401 nobody signed is not the session's, and it would cost the cookies.
      if (!isSessionVerdict(body?.code)) return error;
      const ended = endExpiredSessionResponse();
      ended.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") error.headers.append(key, value);
        else error.headers.set(key, value);
      });
      error.headers.set(SESSION_END_HEADER, "backend");
      return error;
    }
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const tokens = await readBackendJson<AuthTokens>(upstream);
    if (!tokens) {
      return NextResponse.json(
        { error: "UpstreamError", message: "Empty refresh response", code: "INTERNAL" },
        { status: 502 },
      );
    }
    const response = sessionResponse(tokens, undefined, 200, requestId);
    const owner = decodeAccessToken(tokens.accessToken)?.userId;
    const marked = parseSessionMarker(request.cookies.get(SESSION_COOKIE)?.value)?.userId;
    // T-167: a refresh that lands after another user's sign-in brings back its own user's session.
    if (owner && marked && owner !== marked) applyCookies(response, [sessionMarkerCookie(owner)]);
    return response;
  });
}
