import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { unavailableResponse, untrustedOriginResponse } from "@/lib/auth/handlers";
import { logRequest } from "@/lib/observability/log";

import { backendFetch, BackendUnavailableError } from "./backend";
import { IDEMPOTENCY_HEADER } from "./idempotency";
import { REQUEST_ID_HEADER } from "./request-id";

export const PROXY_BODY_LIMIT_BYTES = 64_000;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Session endpoints have dedicated handlers; the proxy must never forward raw tokens for them.
const BLOCKED_PREFIXES = ["auth/login", "auth/register", "auth/refresh", "auth/logout", "auth/me"];
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  REQUEST_ID_HEADER,
  "retry-after",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
];

function isBlocked(path: string): boolean {
  return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function proxyToBackend(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const path = segments.map(encodeURIComponent).join("/");
  if (segments.length === 0 || isBlocked(path)) {
    return NextResponse.json({ error: "NotFound", message: "Unknown API route" }, { status: 404 });
  }
  if (MUTATING.has(request.method)) {
    const denied = untrustedOriginResponse(request);
    if (denied) return denied;
  }
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized", message: "No session" },
      { status: 401, headers: robots() },
    );
  }

  const body = MUTATING.has(request.method) ? await request.text() : "";
  if (body.length > PROXY_BODY_LIMIT_BYTES) {
    return NextResponse.json(
      { error: "PayloadTooLarge", message: "Body too large", code: "VALIDATION" },
      { status: 413 },
    );
  }

  const headers: Record<string, string> = {};
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey;
  if (body.length > 0)
    headers["content-type"] = request.headers.get("content-type") ?? "application/json";

  const startedAt = Date.now();
  const log = (status: number) => {
    logRequest({
      requestId: request.headers.get(REQUEST_ID_HEADER),
      method: request.method,
      path,
      status,
      durationMs: Date.now() - startedAt,
    });
  };
  try {
    const upstream = await backendFetch(`/${path}${request.nextUrl.search}`, {
      method: request.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      accessToken,
      requestId: request.headers.get(REQUEST_ID_HEADER),
      userAgent: request.headers.get("user-agent"),
      headers,
      ...(body.length > 0 ? { rawBody: body } : {}),
    });
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: robots(),
    });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    log(upstream.status);
    return response;
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      const response = unavailableResponse(error);
      for (const [name, value] of Object.entries(robots())) response.headers.set(name, value);
      log(response.status);
      return response;
    }
    throw error;
  }
}

function robots(): Record<string, string> {
  return { "X-Robots-Tag": "noindex, nofollow", "cache-control": "no-store" };
}
