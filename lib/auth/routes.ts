export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const HOME_PATH = "/";
export const APP_HOME_PATH = "/home";
export const ONBOARDING_PATH = "/onboarding";

// §2.6: the app links here when the session is dead and the queue still has to go up.
export const REAUTH_PARAM = "reauth";

const PUBLIC_EXACT = new Set(["/", "/login", "/register", "/privacy", "/terms", "/contact"]);
const PUBLIC_PREFIXES = ["/dev/"];
// P-32/P-33 (owner, 2026-09-08): a device carrying the marker goes to the app, not the pitch.
const GUEST_ONLY = new Set([HOME_PATH, LOGIN_PATH, REGISTER_PATH]);
// One line per screen folder of `app/[locale]/(app)`; `routes.test.ts` fails when one is missing.
const APP_PREFIXES = [
  "/home",
  "/onboarding",
  "/transactions",
  "/accounts",
  "/shared",
  "/categories",
  "/budgets",
  "/stats",
  "/sync",
  "/settings",
];

export function stripLocale(pathname: string, locales: readonly string[]): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isProtectedPath(pathname: string): boolean {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY.has(pathname);
}

const PARSE_ORIGIN = "http://next.invalid";

export function safeNextPath(value: string | null | undefined, fallback = APP_HOME_PATH): string {
  if (!value?.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, PARSE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PARSE_ORIGIN || url.pathname.includes("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
