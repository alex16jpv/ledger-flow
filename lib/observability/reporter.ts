import { ApiError, NetworkError } from "@/lib/api/errors";

export type ReportScope = "api" | "network" | "boundary" | "vault";

export interface ErrorReport {
  scope: ReportScope;
  requestId: string | null;
}

export type ErrorReporter = (error: unknown, report: ErrorReport) => void;

let reporter: ErrorReporter | null = null;

// The tracking SDK registers itself here so the app never imports it directly.
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function requestIdOf(error: unknown): string | null {
  return error instanceof ApiError || error instanceof NetworkError ? error.requestId : null;
}

// 4xx are outcomes the UI explains; offline failures are already shown by the connectivity banner.
export function isReportable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  if (error instanceof NetworkError) return typeof navigator === "undefined" || navigator.onLine;
  return true;
}

export function reportError(error: unknown, scope: ReportScope): void {
  reporter?.(error, { scope, requestId: requestIdOf(error) });
}
