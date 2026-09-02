import { reportNetworkFailure } from "@/lib/network/connectivity";
import type { ErrorResponse } from "@/types/api";

import { ApiError, isErrorCode, NetworkError } from "./errors";
import { IDEMPOTENCY_HEADER, newIdempotencyKey } from "./idempotency";
import { type QueryValue, toQueryString } from "./query";
import { newRequestId, REQUEST_ID_HEADER } from "./request-id";

export const API_PREFIX = "/api";
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequest {
  method?: ApiMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface UnauthorizedContext {
  startedAt: number;
  path: string;
}

export type UnauthorizedHandler = (
  error: ApiError,
  context: UnauthorizedContext,
) => Promise<boolean>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function combineSignals(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(response: Response, payload: unknown, requestId: string): ApiError {
  const body = (payload ?? {}) as Partial<ErrorResponse>;
  return new ApiError({
    status: response.status,
    code: isErrorCode(body.code) ? body.code : null,
    message: typeof body.message === "string" ? body.message : response.statusText,
    details: body.details,
    requestId: response.headers.get(REQUEST_ID_HEADER) ?? requestId,
    retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
  });
}

async function send(path: string, request: ApiRequest, requestId: string): Promise<Response> {
  const { method = "GET", body, query, idempotencyKey, signal, headers = {} } = request;
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    signal: combineSignals(signal),
    headers: {
      accept: "application/json",
      [REQUEST_ID_HEADER]: requestId,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  try {
    return await fetch(`${API_PREFIX}${path}${toQueryString(query)}`, init);
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    if (cause instanceof DOMException && cause.name === "AbortError" && signal?.aborted)
      throw cause;
    reportNetworkFailure();
    throw new NetworkError(requestId, timedOut, cause);
  }
}

export async function api<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const requestId = newRequestId();
  const startedAt = Date.now();
  let response = await send(path, request, requestId);

  if (response.status === 401 && unauthorizedHandler && !path.startsWith("/auth/")) {
    const error = toApiError(response, await readJson(response.clone()), requestId);
    if (await unauthorizedHandler(error, { startedAt, path }))
      response = await send(path, request, requestId);
  }

  if (response.status === 422 && request.idempotencyKey) {
    const payload = await readJson(response.clone());
    const error = toApiError(response, payload, requestId);
    if (error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH") {
      response = await send(path, { ...request, idempotencyKey: newIdempotencyKey() }, requestId);
    }
  }

  const payload = await readJson(response);
  if (!response.ok) throw toApiError(response, payload, requestId);
  return payload as T;
}
