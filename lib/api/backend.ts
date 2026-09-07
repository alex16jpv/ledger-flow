import "server-only";

import { env } from "@/lib/env";

import { REQUEST_ID_HEADER } from "./request-id";

export interface BackendRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  rawBody?: string;
  accessToken?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const BACKEND_TIMEOUT_MS = 15_000;
// The backend's gateway check: with API_SECRET set it rejects every request lacking this header.
export const API_SECRET_HEADER = "x-api-secret";

// The only place that knows the backend URL; every route handler goes through it.
export async function backendFetch(path: string, request: BackendRequest = {}): Promise<Response> {
  const {
    method = "GET",
    body,
    rawBody,
    accessToken,
    requestId,
    userAgent,
    headers = {},
    signal,
  } = request;
  try {
    return await fetch(`${env.API_URL}${path}`, {
      method,
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        ...(env.API_SECRET ? { [API_SECRET_HEADER]: env.API_SECRET } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
        ...(userAgent ? { "user-agent": userAgent } : {}),
        ...headers,
      },
      ...(rawBody !== undefined
        ? { body: rawBody }
        : body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
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
