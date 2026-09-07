import { type NextRequest, NextResponse } from "next/server";

import { backendFetch, readBackendJson } from "@/lib/api/backend";
import { REQUEST_ID_HEADER } from "@/lib/api/request-id";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { forwardedRequestId, passThroughError, withBackend } from "@/lib/auth/handlers";
import { decodeAccessToken } from "@/lib/auth/jwt";
import type { User } from "@/types/api";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const claims = decodeAccessToken(accessToken);
  if (!accessToken || !claims) {
    return NextResponse.json({ error: "Unauthorized", message: "No session" }, { status: 401 });
  }
  const requestId = forwardedRequestId(request);
  return withBackend(async () => {
    const upstream = await backendFetch(`/users/${claims.userId}`, { accessToken, requestId });
    if (!upstream.ok) return passThroughError(upstream, requestId);
    const user = await readBackendJson<User>(upstream);
    const response = NextResponse.json({ user }, { headers: { "cache-control": "no-store" } });
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  });
}
