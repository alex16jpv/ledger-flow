import { ApiError, type ErrorMessageKey, presentError } from "@/lib/api/errors";

export const RETRY_AFTER_FALLBACK_SECONDS = 60;

export type EmailFailure =
  | "human"
  | "settings.credentials.emailUndeliverable"
  | "errors.EMAIL_SEND_FAILED"
  | ErrorMessageKey;

export function emailFailure(error: unknown): EmailFailure {
  if (error instanceof ApiError && error.code === "EMAIL_SEND_FAILED") {
    return error.status === 422
      ? "settings.credentials.emailUndeliverable"
      : "errors.EMAIL_SEND_FAILED";
  }
  if (error instanceof ApiError && error.code === "CAPTCHA_INVALID") return "human";
  return presentError(error).messageKey;
}
