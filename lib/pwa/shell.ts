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

// Every static route of `(app)`, so one the user never opened still has a shell with no network
// (§6 O-F6). `shell.test.ts` checks this list against the route files: a screen added without an
// entry here is a screen that answers `offline.html` the first time it is needed offline (F-47).
export const SHELL_PATHS = [
  "/home",
  "/transactions",
  "/transactions/new",
  "/transactions/review",
  "/budgets",
  "/budgets/new",
  "/budgets/past",
  "/accounts",
  "/accounts/new",
  "/categories",
  "/categories/new",
  "/stats",
  "/settings",
  "/settings/appearance",
  "/settings/profile",
  "/settings/sessions",
  "/settings/sync",
  "/sync",
] as const;

// The dynamic routes, cached once per template rather than once per id: the document and the RSC
// payload of a detail screen carry no id (the screen reads it from the URL, `useDetailRouteId`), so
// one entry answers every row — including one created on this device with no network (F-48).
export const DETAIL_TEMPLATES = [
  "/transactions/[id]",
  "/transactions/[id]/edit",
  "/accounts/[id]",
  "/accounts/[id]/edit",
  "/budgets/[id]",
  "/budgets/[id]/edit",
  "/categories/[id]/edit",
] as const;

// A valid UUID no row will ever have: the request that warms a template has to name some id.
export const TEMPLATE_ID = "00000000-0000-7000-8000-000000000000";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SHELL_CACHE = "app-shell";

export const WARM_SHELL_MESSAGE = "ledger-flow-warm-shell";

// The worker's answer when it has been through the list: the page has no other way to know the
// warm ended, and "Ready to use offline" is a promise nobody should make early (F-54).
export const SHELL_WARMED_MESSAGE = "ledger-flow-shell-warmed";

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

// `/accounts/<uuid>` and `/accounts/<uuid>/edit` become their template; every other path is itself.
export function templatePath(pathname: string): string {
  const segments = pathname.split("/");
  const at = localeOf(pathname) === DEFAULT_LOCALE ? 2 : 3;
  const id = segments[at];
  if (id === undefined || !UUID.test(id)) return pathname;
  if (!(APP_SEGMENTS as readonly string[]).includes(segments[at - 1] ?? "")) return pathname;
  return [...segments.slice(0, at), "[id]", ...segments.slice(at + 1)].join("/");
}

// One entry per route: a filter, a month and Next's own `_rsc` token live in the query string, and
// neither the document nor the RSC payload behind them depends on it (F-06); a row's id lives in
// the path, and the shell of a detail route does not depend on it either (F-48).
export function shellCacheKey(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${templatePath(parsed.pathname)}`;
}

// The URL that fetches a cache key: a template needs a real-looking id in place of `[id]`.
export function warmUrlFor(cacheKey: string): string {
  return cacheKey.replace("[id]", TEMPLATE_ID);
}

// The fallback is a static file, so its text cannot come from `messages/`: there is one per locale.
export function offlineDocument(pathname: string): string {
  return localeOf(pathname) === DEFAULT_LOCALE
    ? "/offline.html"
    : `/offline.${localeOf(pathname)}.html`;
}

// How many screens a prepared device holds, which is what Sync status counts against (F-54).
export const SHELL_SCREENS = SHELL_PATHS.length + DETAIL_TEMPLATES.length;

export function shellUrls(locale: string, origin: string): string[] {
  const prefix = localePrefix(locale);
  return [...SHELL_PATHS, ...DETAIL_TEMPLATES].map((path) =>
    warmUrlFor(`${origin}${prefix}${path}`),
  );
}
