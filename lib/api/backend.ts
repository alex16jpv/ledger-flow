import "server-only";

import { env } from "@/lib/env";

import { REQUEST_ID_HEADER } from "./request-id";

export interface BackendRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const BACKEND_TIMEOUT_MS = 15_000;

// The only place that knows the backend URL; every route handler goes through it.
export async function backendFetch(path: string, request: BackendRequest = {}): Promise<Response> {
  const { method = "GET", body, accessToken, requestId, userAgent, headers = {}, signal } = request;
  try {
    return await fetch(`${env.API_URL}${path}`, {
      method,
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
        ...(userAgent ? { "user-agent": userAgent } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    throw toBackendUnavailable(cause);
  }
}

export class BackendUnavailableError extends Error {
  readonly timedOut: boolean;

  constructor(timedOut: boolean, cause?: unknown) {
    super(timedOut ? "Backend timed out" : "Backend unreachable", { cause });
    this.name = "BackendUnavailableError";
    this.timedOut = timedOut;
  }
}

export function toBackendUnavailable(cause: unknown): BackendUnavailableError {
  const timedOut = cause instanceof Error && cause.name === "TimeoutError";
  return new BackendUnavailableError(timedOut, cause);
}

export async function readBackendJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
