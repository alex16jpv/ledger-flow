import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, readBackendJson } from "@/lib/api/backend";
import { clientIpOf } from "@/lib/api/client-ip";
import {
  ACCESS_COOKIE,
  deviceCookie,
  expiredSessionCookies,
  REFRESH_COOKIE,
  sessionCookies,
} from "@/lib/auth/cookies";
import {
  applyCookies,
  endSessionResponse,
  forwardedRequestId,
  passThroughError,
  untrustedOriginResponse,
  withBackend,
} from "@/lib/auth/handlers";
import type { AuthTokens, LoggedOutEverywhere } from "@/types/api";

const NO_SESSION = { error: "Unauthorized", message: "No session", code: "REFRESH_INVALID" };

export async function POST(request: NextRequest) {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const requestId = forwardedRequestId(request);
  const clientIp = clientIpOf(request);
  const revoke = (accessToken: string) =>
    backendFetch("/auth/logout-all", { method: "POST", accessToken, requestId, clientIp });
  return withBackend(async () => {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    let upstream = accessToken ? await revoke(accessToken) : null;
    let renewed: AuthTokens | null = null;
    // The access cookie lives 15 minutes and the client never renews a call to /auth/.
    if (!upstream || upstream.status === 401) {
      const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
      if (!refreshToken) {
        return applyCookies(
          NextResponse.json(NO_SESSION, { status: 401 }),
          expiredSessionCookies(),
        );
      }
      const refreshed = await backendFetch("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        requestId,
        clientIp,
        userAgent: request.headers.get("user-agent"),
      });
      if (refreshed.status === 401) {
        return applyCookies(await passThroughError(refreshed, requestId), expiredSessionCookies());
      }
      if (!refreshed.ok) return passThroughError(refreshed, requestId);
      renewed = await readBackendJson<AuthTokens>(refreshed);
      if (!renewed) {
        return NextResponse.json(
          { error: "UpstreamError", message: "Empty refresh response", code: "INTERNAL" },
          { status: 502 },
        );
      }
      upstream = await revoke(renewed.accessToken);
    }
    if (!upstream.ok) {
      const failed = await passThroughError(upstream, requestId);
      return renewed ? applyCookies(failed, sessionCookies(renewed)) : failed;
    }
    const answer = await readBackendJson<LoggedOutEverywhere>(upstream);
    const response = endSessionResponse();
    return answer?.deviceToken
      ? applyCookies(response, [deviceCookie(answer.deviceToken)])
      : response;
  });
}
