import { isErrorCode } from "@/lib/api/errors";

export const SESSION_END_HEADER = "x-lf-session-end";

// H-10: a 401 carrying neither the backend's verdict nor this app's is nobody's word.
export type SessionEnd = "backend" | "no-cookie";

export function isSessionEnd(value: string | null): value is SessionEnd {
  return value === "backend" || value === "no-cookie";
}

// The two codes that mean the token itself is over; anything else on a 401 is not the session.
export function isSessionVerdict(code: unknown): boolean {
  return isErrorCode(code) && (code === "REFRESH_INVALID" || code === "REFRESH_REVOKED");
}

export class SessionEndedError extends Error {
  readonly by: SessionEnd;

  constructor(by: SessionEnd, code: string | null) {
    super(`session_ended by=${by} code=${code ?? "none"}`);
    this.name = "SessionEndedError";
    this.by = by;
  }
}
