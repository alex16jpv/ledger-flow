import type { NextRequest } from "next/server";

import { backendFetch } from "@/lib/api/backend";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import {
  endSessionResponse,
  forwardedRequestId,
  passThroughError,
  untrustedOriginResponse,
  withBackend,
} from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const requestId = forwardedRequestId(request);
  return withBackend(async () => {
    if (accessToken) {
      const upstream = await backendFetch("/auth/logout-all", {
        method: "POST",
        accessToken,
        requestId,
      });
      if (!upstream.ok && upstream.status !== 401) return passThroughError(upstream, requestId);
    }
    return endSessionResponse();
  });
}
