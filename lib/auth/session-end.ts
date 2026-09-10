import { isErrorCode } from "@/lib/api/errors";

export const SESSION_END_HEADER = "x-lf-session-end";

// Who ended the session: the backend's verdict on the refresh token, or this app when the browser
// sent no refresh cookie. A 401 carrying neither is nobody's word (H-10).
export type SessionEnd = "backend" | "no-cookie";

export function isSessionEnd(value: string | null): value is SessionEnd {
  return value === "backend" || value === "no-cookie";
}

// The two codes that mean the token itself is over. Anything else on a 401 — no code at all, an
// edge's own page, a gateway restarting mid-deploy — did not come from the session.
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
