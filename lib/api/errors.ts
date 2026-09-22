import type en from "@/messages/en.json";
import type { ErrorResponse } from "@/types/api";

export type ErrorMessageKey = `errors.${keyof typeof en.errors}`;

export const ERROR_CODES = [
  "VALIDATION",
  "INVALID_ID",
  "NOT_FOUND",
  "DUPLICATE",
  "EMAIL_TAKEN",
  "NO_DEFAULT_ACCOUNT",
  "DEFAULT_ACCOUNT_ARCHIVE_BLOCKED",
  "ACCOUNT_LIMIT_REACHED",
  "ACCOUNT_FIELD_NOT_FOR_TYPE",
  "INCOME_ON_CARD_OR_LOAN",
  "LOAN_OVERPAID",
  "CATEGORY_LIMIT_REACHED",
  "CATEGORY_ARCHIVED",
  "CATEGORY_TYPE_MISMATCH",
  "CATEGORY_TYPE_LOCKED",
  "RESOURCE_ARCHIVED",
  "BUDGET_PERIOD_OVERLAP",
  "CONTACT_LIMIT_REACHED",
  "PARTICIPANT_LIMIT_REACHED",
  "PARTICIPANT_ALREADY_IN_GROUP",
  "PARTICIPANT_NOT_IN_GROUP",
  "PARTICIPANT_IN_USE",
  "SPLIT_INVALID",
  "SHARED_EXPENSE_LINKED",
  "TRANSACTION_ALREADY_SHARED",
  "TRANSACTION_NOT_SPLITTABLE",
  "SETTLEMENT_OVER_PAID",
  "SETTLEMENT_MOVEMENT_LOCKED",
  "GUEST_BLOCK_HAS_PAYMENTS",
  "CONTACT_HAS_NO_EMAIL",
  "INVITATION_TO_SELF",
  "INVITATION_LIMIT_REACHED",
  "INVITATION_UNAVAILABLE",
  "ID_TAKEN",
  "STALE_UPDATE",
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
  "BAD_REQUEST",
  "MALFORMED_JSON",
  "PAYLOAD_TOO_LARGE",
  "REQUEST_ABORTED",
  "UNSUPPORTED_ENCODING",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorScope = "field" | "form" | "toast" | "screen" | "session" | "rateLimit";

export interface ErrorPresentation {
  scope: ErrorScope;
  field?: string;
  messageKey: ErrorMessageKey;
}

// Where each code is shown, and its field when it is a field error. Its key is the code itself.
const SHOWN: Readonly<Record<ErrorCode, readonly [ErrorScope, string?]>> = {
  VALIDATION: ["form"],
  INVALID_ID: ["screen"],
  NOT_FOUND: ["screen"],
  DUPLICATE: ["field", "name"],
  EMAIL_TAKEN: ["field", "email"],
  NO_DEFAULT_ACCOUNT: ["field", "accountId"],
  DEFAULT_ACCOUNT_ARCHIVE_BLOCKED: ["form"],
  ACCOUNT_LIMIT_REACHED: ["form"],
  ACCOUNT_FIELD_NOT_FOR_TYPE: ["form"],
  INCOME_ON_CARD_OR_LOAN: ["field", "toAccountId"],
  LOAN_OVERPAID: ["field", "amount"],
  CATEGORY_LIMIT_REACHED: ["form"],
  CATEGORY_ARCHIVED: ["field", "categoryId"],
  CATEGORY_TYPE_MISMATCH: ["field", "categoryId"],
  CATEGORY_TYPE_LOCKED: ["field", "type"],
  RESOURCE_ARCHIVED: ["form"],
  BUDGET_PERIOD_OVERLAP: ["form"],
  CONTACT_LIMIT_REACHED: ["form"],
  PARTICIPANT_LIMIT_REACHED: ["form"],
  PARTICIPANT_ALREADY_IN_GROUP: ["field", "contactIds"],
  PARTICIPANT_NOT_IN_GROUP: ["field", "contactIds"],
  PARTICIPANT_IN_USE: ["form"],
  SPLIT_INVALID: ["field", "split"],
  SHARED_EXPENSE_LINKED: ["form"],
  TRANSACTION_ALREADY_SHARED: ["field", "transactionId"],
  TRANSACTION_NOT_SPLITTABLE: ["field", "transactionId"],
  SETTLEMENT_OVER_PAID: ["field", "paid"],
  SETTLEMENT_MOVEMENT_LOCKED: ["form"],
  GUEST_BLOCK_HAS_PAYMENTS: ["form"],
  CONTACT_HAS_NO_EMAIL: ["form"],
  INVITATION_TO_SELF: ["form"],
  INVITATION_LIMIT_REACHED: ["form"],
  INVITATION_UNAVAILABLE: ["form"],
  // The outbox answers ID_TAKEN by minting a new id and retrying (O-F4); this is the fallback for the online path.
  ID_TAKEN: ["toast"],
  STALE_UPDATE: ["form"],
  CURRENCY_LOCKED: ["field", "currency"],
  CURRENCY_MISMATCH: ["field", "toAccountId"],
  AMOUNT_PRECISION: ["field", "amount"],
  FUTURE_DATE: ["field", "date"],
  INVALID_CURSOR: ["toast"],
  IDEMPOTENCY_KEY_INVALID: ["toast"],
  IDEMPOTENCY_PAYLOAD_MISMATCH: ["toast"],
  IDEMPOTENCY_ORIGINAL_DELETED: ["toast"],
  REFRESH_INVALID: ["session"],
  REFRESH_REVOKED: ["session"],
  CURRENT_PASSWORD_INVALID: ["field", "currentPassword"],
  RATE_LIMITED: ["rateLimit"],
  DB_UNAVAILABLE: ["screen"],
  INTERNAL: ["screen"],
  BAD_REQUEST: ["form"],
  MALFORMED_JSON: ["toast"],
  PAYLOAD_TOO_LARGE: ["form"],
  REQUEST_ABORTED: ["toast"],
  UNSUPPORTED_ENCODING: ["toast"],
};

export const ERROR_TABLE: Readonly<Record<ErrorCode, ErrorPresentation>> = Object.fromEntries(
  ERROR_CODES.map((code) => {
    const [scope, field] = SHOWN[code];
    return [code, { scope, ...(field ? { field } : {}), messageKey: `errors.${code}` }];
  }),
) as Readonly<Record<ErrorCode, ErrorPresentation>>;

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
  current?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly details: NonNullable<ErrorResponse["details"]>;
  readonly requestId: string;
  readonly retryAfterSeconds: number | undefined;
  // O-B2: what `409 STALE_UPDATE` carries — the server's row. Absent on every other error.
  readonly current: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.current = init.current;
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
    // Zod details arrive as "body.amount" / "query.limit": the form only knows the bare field name.
    const field = detail.field?.replace(/^(body|query|params)\./, "");
    if (field && detail.message && !(field in fields)) fields[field] = detail.message;
  }
  return fields;
}
