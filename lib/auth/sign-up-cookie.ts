import "server-only";

import type { CookieSpec } from "./cookies";

export const SIGN_UP_COOKIE = "__Secure-sign-up";
export const SIGN_UP_COOKIE_PATH = "/api/auth/sign-up";

export interface PendingSignUp {
  token: string;
  email: string;
  expiresAt: number;
  resendAt: number;
}

// The browser that typed the password keeps its sign-up for the 24 hours the server holds it, and only here.
export function signUpCookie(pending: PendingSignUp, now = Date.now()): CookieSpec {
  return {
    name: SIGN_UP_COOKIE,
    value: Buffer.from(JSON.stringify(pending)).toString("base64url"),
    path: SIGN_UP_COOKIE_PATH,
    maxAge: Math.max(0, Math.floor((pending.expiresAt - now) / 1000)),
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };
}

export function expiredSignUpCookie(): CookieSpec {
  return { ...signUpCookie({ token: "", email: "", expiresAt: 0, resendAt: 0 }), value: "" };
}

const isPending = (value: unknown): value is PendingSignUp => {
  if (typeof value !== "object" || value === null) return false;
  const { token, email, expiresAt, resendAt } = value as Record<string, unknown>;
  return (
    typeof token === "string" &&
    token.length > 0 &&
    typeof email === "string" &&
    typeof expiresAt === "number" &&
    typeof resendAt === "number"
  );
};

export function parseSignUpCookie(
  value: string | undefined,
  now = Date.now(),
): PendingSignUp | null {
  if (!value) return null;
  try {
    const pending: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return isPending(pending) && pending.expiresAt > now ? pending : null;
  } catch {
    return null;
  }
}
