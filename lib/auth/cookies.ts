export const ACCESS_COOKIE = "__Host-access";
// __Host- forbids a Path other than "/", so the refresh cookie uses __Secure- to stay scoped to the BFF.
export const REFRESH_COOKIE = "__Secure-refresh";
export const SESSION_COOKIE = "__Host-session";

export const ACCESS_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
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

export function sessionMarkerCookie(): CookieSpec {
  return {
    name: SESSION_COOKIE,
    value: "1",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  };
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

export function sessionCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}): CookieSpec[] {
  return [
    accessCookie(tokens.accessToken),
    refreshCookie(tokens.refreshToken),
    sessionMarkerCookie(),
  ];
}

export function expiredSessionCookies(): CookieSpec[] {
  return sessionCookies({ accessToken: "", refreshToken: "" }).map((cookie) => ({
    ...cookie,
    value: "",
    maxAge: 0,
  }));
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
