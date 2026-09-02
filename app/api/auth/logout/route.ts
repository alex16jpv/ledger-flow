import type { NextRequest } from "next/server";

import { backendFetch } from "@/lib/api/backend";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import {
  endSessionResponse,
  forwardedRequestId,
  untrustedOriginResponse,
} from "@/lib/auth/handlers";

export async function POST(request: NextRequest) {
  const denied = untrustedOriginResponse(request);
  if (denied) return denied;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await backendFetch("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        requestId: forwardedRequestId(request),
      });
    } catch {
      // The device session may outlive this request; the local cookies are cleared regardless.
    }
  }
  return endSessionResponse();
}
