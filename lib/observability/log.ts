import "server-only";

export interface RequestLog {
  requestId: string | null;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

// One JSON line per BFF call, path without query string and never a body: enough to follow a requestId.
export function formatRequestLog(entry: RequestLog, at = new Date()): string {
  return JSON.stringify({
    level: entry.status >= 500 ? "error" : "info",
    msg: "request",
    at: at.toISOString(),
    ...entry,
  });
}

export function logRequest(entry: RequestLog): void {
  if (process.env.NODE_ENV === "test") return;
  // eslint-disable-next-line no-console -- structured request log is the only intended stdout writer
  console.info(formatRequestLog(entry));
}
