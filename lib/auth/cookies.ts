export const ACCESS_COOKIE = "__Host-access";
// __Host- forbids a Path other than "/", so the refresh cookie uses __Secure- to stay scoped to the BFF.
export const REFRESH_COOKIE = "__Secure-refresh";
export const SESSION_COOKIE = "__Host-session";

export const ACCESS_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
// The marker outlives the refresh token on purpose (§2.6): it says "this device holds a vault for
// this user", never "the session is valid". 400 days is the ceiling browsers cap Max-Age at.
export const SESSION_MARKER_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
export const LOCALE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const REFRESH_COOKIE_PATH = "/api/auth";

export interface CookieSpec {
  name: string;
  value: string;
  path: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax";
}

export function accessCookie(token: string): CookieSpec {
  return {
    name: ACCESS_COOKIE,
    value: token,
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };
}

export function refreshCookie(token: string): CookieSpec {
  return {
    name: REFRESH_COOKIE,
    value: token,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  };
}

// `<userId>.<issued at, seconds>`: which vault to open without a session, and how old the marker is
// when the vault turned out to be gone (D-20). Readable by scripts because the app reads it; it is
// not a credential, and treating it as one is what §2.6 forbids.
export function sessionMarkerCookie(userId: string, issuedAtMs = Date.now()): CookieSpec {
  return {
    name: SESSION_COOKIE,
    value: `${userId}.${Math.floor(issuedAtMs / 1000)}`,
    path: "/",
    maxAge: SESSION_MARKER_MAX_AGE_SECONDS,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
  };
}

export interface SessionMarker {
  userId: string;
  issuedAt: number;
}

export function parseSessionMarker(value: string | undefined): SessionMarker | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  const userId = separator === -1 ? value : value.slice(0, separator);
  if (!userId) return null;
  const seconds = separator === -1 ? Number.NaN : Number(value.slice(separator + 1));
  return { userId, issuedAt: Number.isFinite(seconds) ? seconds * 1000 : Number.NaN };
}

export function localeCookie(name: string, locale: string): CookieSpec {
  return {
    name,
    value: locale,
    path: "/",
    maxAge: LOCALE_MAX_AGE_SECONDS,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
  };
}

// The marker is only rewritten when the user is known: a refresh answers tokens and no user, and
// re-stamping it with an empty id would cost the device its vault.
export function sessionCookies(
  tokens: { accessToken: string; refreshToken: string },
  userId?: string,
): CookieSpec[] {
  const cookies = [accessCookie(tokens.accessToken), refreshCookie(tokens.refreshToken)];
  if (userId) cookies.push(sessionMarkerCookie(userId));
  return cookies;
}

const expire = (cookie: CookieSpec): CookieSpec => ({ ...cookie, value: "", maxAge: 0 });

// A dead refresh token is not a logout: the marker stays, so the app opens in local mode (§2.6).
export function expiredAuthCookies(): CookieSpec[] {
  return [accessCookie(""), refreshCookie("")].map(expire);
}

// Explicit logout, the only thing that takes the marker away.
export function expiredSessionCookies(): CookieSpec[] {
  return [...expiredAuthCookies(), expire(sessionMarkerCookie("x"))];
}

export function serializeCookie(cookie: CookieSpec): string {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    `SameSite=${cookie.sameSite === "strict" ? "Strict" : "Lax"}`,
  ];
  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");
  return parts.join("; ");
}
