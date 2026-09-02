import type en from "@/messages/en.json";
import type { ErrorResponse } from "@/types/api";

export type ErrorMessageKey = `errors.${keyof typeof en.errors}`;

export const ERROR_CODES = [
  "VALIDATION",
  "INVALID_ID",
  "DUPLICATE",
  "EMAIL_TAKEN",
  "NO_DEFAULT_ACCOUNT",
  "DEFAULT_ACCOUNT_ARCHIVE_BLOCKED",
  "ACCOUNT_LIMIT_REACHED",
  "CATEGORY_LIMIT_REACHED",
  "CATEGORY_ARCHIVED",
  "CATEGORY_TYPE_MISMATCH",
  "CATEGORY_TYPE_LOCKED",
  "RESOURCE_ARCHIVED",
  "BUDGET_PERIOD_OVERLAP",
  "CURRENCY_LOCKED",
  "CURRENCY_MISMATCH",
  "AMOUNT_PRECISION",
  "FUTURE_DATE",
  "INVALID_CURSOR",
  "IDEMPOTENCY_KEY_INVALID",
  "IDEMPOTENCY_PAYLOAD_MISMATCH",
  "IDEMPOTENCY_ORIGINAL_DELETED",
  "REFRESH_INVALID",
  "REFRESH_REVOKED",
  "CURRENT_PASSWORD_INVALID",
  "RATE_LIMITED",
  "DB_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorScope = "field" | "form" | "toast" | "screen" | "session" | "rateLimit";

export interface ErrorPresentation {
  scope: ErrorScope;
  field?: string;
  messageKey: ErrorMessageKey;
}

export const ERROR_TABLE: Readonly<Record<ErrorCode, ErrorPresentation>> = {
  VALIDATION: { scope: "form", messageKey: "errors.VALIDATION" },
  INVALID_ID: { scope: "screen", messageKey: "errors.INVALID_ID" },
  DUPLICATE: { scope: "field", field: "name", messageKey: "errors.DUPLICATE" },
  EMAIL_TAKEN: { scope: "field", field: "email", messageKey: "errors.EMAIL_TAKEN" },
  NO_DEFAULT_ACCOUNT: {
    scope: "field",
    field: "accountId",
    messageKey: "errors.NO_DEFAULT_ACCOUNT",
  },
  DEFAULT_ACCOUNT_ARCHIVE_BLOCKED: {
    scope: "form",
    messageKey: "errors.DEFAULT_ACCOUNT_ARCHIVE_BLOCKED",
  },
  ACCOUNT_LIMIT_REACHED: { scope: "form", messageKey: "errors.ACCOUNT_LIMIT_REACHED" },
  CATEGORY_LIMIT_REACHED: { scope: "form", messageKey: "errors.CATEGORY_LIMIT_REACHED" },
  CATEGORY_ARCHIVED: {
    scope: "field",
    field: "categoryId",
    messageKey: "errors.CATEGORY_ARCHIVED",
  },
  CATEGORY_TYPE_MISMATCH: {
    scope: "field",
    field: "categoryId",
    messageKey: "errors.CATEGORY_TYPE_MISMATCH",
  },
  CATEGORY_TYPE_LOCKED: {
    scope: "field",
    field: "type",
    messageKey: "errors.CATEGORY_TYPE_LOCKED",
  },
  RESOURCE_ARCHIVED: { scope: "form", messageKey: "errors.RESOURCE_ARCHIVED" },
  BUDGET_PERIOD_OVERLAP: { scope: "form", messageKey: "errors.BUDGET_PERIOD_OVERLAP" },
  CURRENCY_LOCKED: { scope: "field", field: "currency", messageKey: "errors.CURRENCY_LOCKED" },
  CURRENCY_MISMATCH: {
    scope: "field",
    field: "toAccountId",
    messageKey: "errors.CURRENCY_MISMATCH",
  },
  AMOUNT_PRECISION: { scope: "field", field: "amount", messageKey: "errors.AMOUNT_PRECISION" },
  FUTURE_DATE: { scope: "field", field: "date", messageKey: "errors.FUTURE_DATE" },
  INVALID_CURSOR: { scope: "toast", messageKey: "errors.INVALID_CURSOR" },
  IDEMPOTENCY_KEY_INVALID: { scope: "toast", messageKey: "errors.IDEMPOTENCY_KEY_INVALID" },
  IDEMPOTENCY_PAYLOAD_MISMATCH: {
    scope: "toast",
    messageKey: "errors.IDEMPOTENCY_PAYLOAD_MISMATCH",
  },
  IDEMPOTENCY_ORIGINAL_DELETED: {
    scope: "toast",
    messageKey: "errors.IDEMPOTENCY_ORIGINAL_DELETED",
  },
  REFRESH_INVALID: { scope: "session", messageKey: "errors.REFRESH_INVALID" },
  REFRESH_REVOKED: { scope: "session", messageKey: "errors.REFRESH_REVOKED" },
  CURRENT_PASSWORD_INVALID: {
    scope: "field",
    field: "currentPassword",
    messageKey: "errors.CURRENT_PASSWORD_INVALID",
  },
  RATE_LIMITED: { scope: "rateLimit", messageKey: "errors.RATE_LIMITED" },
  DB_UNAVAILABLE: { scope: "screen", messageKey: "errors.DB_UNAVAILABLE" },
  INTERNAL: { scope: "screen", messageKey: "errors.INTERNAL" },
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export interface ApiErrorInit {
  status: number;
  code: ErrorCode | null;
  message: string;
  details?: ErrorResponse["details"];
  requestId: string;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly details: NonNullable<ErrorResponse["details"]>;
  readonly requestId: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

export class NetworkError extends Error {
  readonly requestId: string;
  readonly timedOut: boolean;

  constructor(requestId: string, timedOut: boolean, cause?: unknown) {
    super(timedOut ? "Request timed out" : "Network request failed", { cause });
    this.name = "NetworkError";
    this.requestId = requestId;
    this.timedOut = timedOut;
  }
}

const STATUS_FALLBACK: Record<number, ErrorPresentation> = {
  400: { scope: "form", messageKey: "errors.VALIDATION" },
  401: { scope: "session", messageKey: "errors.UNAUTHORIZED" },
  404: { scope: "screen", messageKey: "errors.NOT_FOUND" },
  409: { scope: "form", messageKey: "errors.DUPLICATE" },
  429: { scope: "rateLimit", messageKey: "errors.RATE_LIMITED" },
  503: { scope: "screen", messageKey: "errors.DB_UNAVAILABLE" },
};

export function presentError(error: unknown): ErrorPresentation {
  if (error instanceof NetworkError) {
    return { scope: "screen", messageKey: error.timedOut ? "errors.TIMEOUT" : "errors.NETWORK" };
  }
  if (error instanceof ApiError) {
    if (error.code) return ERROR_TABLE[error.code];
    return STATUS_FALLBACK[error.status] ?? { scope: "screen", messageKey: "errors.INTERNAL" };
  }
  return { scope: "screen", messageKey: "errors.UNKNOWN" };
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const fields: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.field && detail.message && !(detail.field in fields))
      fields[detail.field] = detail.message;
  }
  return fields;
}
