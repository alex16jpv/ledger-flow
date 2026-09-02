import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, readBackendJson } from "@/lib/api/backend";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import {
  endSessionResponse,
  forwardedRequestId,
  passThroughError,
  sessionResponse,
  untrustedOriginResponse,
  withBackend,
} from "@/lib/auth/handlers";
import type { AuthTokens } from "@/types/api";

export async function POST(request: NextRequest) {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const response = endSessionResponse(401);
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
      userAgent: request.headers.get("user-agent"),
    });
    if (upstream.status === 401) {
      const error = await passThroughError(upstream, requestId);
      const ended = endSessionResponse(401);
      ended.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") error.headers.append(key, value);
        else error.headers.set(key, value);
      });
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
    return sessionResponse(tokens, undefined, 200, requestId);
  });
}
