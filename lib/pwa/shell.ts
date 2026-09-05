import { DEFAULT_LOCALE, localeOf, localePrefix } from "@/lib/i18n/locales";

// Every first segment of the `(app)` group: what the worker may answer from its own caches without
// leaving the frame. Anything else (the landing, login, the legal pages) stays on `defaultCache`.
const APP_SEGMENTS = [
  "home",
  "transactions",
  "budgets",
  "accounts",
  "categories",
  "stats",
  "settings",
  "sync",
] as const;

// The routes the worker fetches ahead of time, so one the user never opened still has a shell with
// no network (§6 O-F6). Detail routes are not here: they arrive with whatever the user visits.
export const SHELL_PATHS = [
  "/home",
  "/transactions",
  "/transactions/new",
  "/budgets",
  "/accounts",
  "/categories",
  "/stats",
  "/settings",
  "/sync",
] as const;

export const SHELL_CACHE = "app-shell";
export const SHELL_RSC_CACHE = "app-shell-rsc";

export const WARM_SHELL_MESSAGE = "ledger-flow-warm-shell";

export interface WarmShellMessage {
  type: typeof WARM_SHELL_MESSAGE;
  urls: string[];
}

function withoutLocale(pathname: string): string {
  const locale = localeOf(pathname);
  return locale === DEFAULT_LOCALE ? pathname : pathname.slice(locale.length + 1);
}

export function isShellPath(pathname: string): boolean {
  const segment = withoutLocale(pathname).split("/")[1] ?? "";
  return (APP_SEGMENTS as readonly string[]).includes(segment);
}

// One entry per route: a filter, a month and Next's own `_rsc` token live in the query string, and
// neither the document nor the RSC payload behind them depends on it (F-06).
export function shellCacheKey(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

// The fallback is a static file, so its text cannot come from `messages/`: there is one per locale.
export function offlineDocument(pathname: string): string {
  return localeOf(pathname) === DEFAULT_LOCALE
    ? "/offline.html"
    : `/offline.${localeOf(pathname)}.html`;
}

export function shellUrls(locale: string, origin: string): string[] {
  const prefix = localePrefix(locale);
  return SHELL_PATHS.map((path) => `${origin}${prefix}${path}`);
}
