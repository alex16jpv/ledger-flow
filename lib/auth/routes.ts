export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const HOME_PATH = "/";
export const APP_HOME_PATH = "/home";
export const ONBOARDING_PATH = "/onboarding";

// Says "I know I have a marker, let me at the login anyway": the app links here when the session is
// dead and the queue still has to go up (§2.6).
export const REAUTH_PARAM = "reauth";

const PUBLIC_EXACT = new Set(["/", "/login", "/register", "/privacy", "/terms", "/contact"]);
const PUBLIC_PREFIXES = ["/dev/"];
const GUEST_ONLY = new Set(["/login", "/register"]);
// One line per screen folder of `app/[locale]/(app)`, minus `dev/`, which the componentCatalog flag
// guards instead; anything else unknown must reach the real 404, not the login. `routes.test.ts`
// reads the folder and fails when a screen is missing here — F-75 was `/sync` missing for a month.
const APP_PREFIXES = [
  "/home",
  "/onboarding",
  "/transactions",
  "/accounts",
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

export function safeNextPath(value: string | null, fallback = APP_HOME_PATH): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
