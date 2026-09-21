import { isEntityId } from "@/lib/api/entity-id";
import { DEFAULT_LOCALE, isAppLocale, localeOf, localePrefix } from "@/lib/i18n/locales";

// Anything else — the landing, login, the legal pages — stays on `defaultCache`.
const APP_SEGMENTS = [
  "home",
  "transactions",
  "budgets",
  "accounts",
  "shared",
  "categories",
  "stats",
  "settings",
  "sync",
] as const;

// F-47: `shell.test.ts` checks this against the route files; a missing entry is `offline.html`.
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
  "/shared",
  "/categories",
  "/categories/new",
  "/stats",
  "/stats/trends",
  "/settings",
  "/settings/appearance",
  "/settings/profile",
  "/settings/sessions",
  "/settings/sync",
  "/sync",
] as const;

// F-48: one entry per template — the screen reads its id from the URL, not from the payload.
export const DETAIL_TEMPLATES = [
  "/transactions/[id]",
  "/transactions/[id]/edit",
  "/accounts/[id]",
  "/accounts/[id]/edit",
  "/budgets/[id]",
  "/budgets/[id]/edit",
  "/categories/[id]/edit",
  "/shared/groups/[id]",
  "/shared/people/[id]",
] as const;

// The id a path carries for one of the templates above, or undefined when it matches none of them.
export function detailRouteId(pathname: string): string | undefined {
  const segments = pathname.split("/");
  for (const template of DETAIL_TEMPLATES) {
    const parts = template.split("/");
    if (parts.length !== segments.length) continue;
    const at = parts.indexOf("[id]");
    if (parts.every((part, index) => part === "[id]" || part === segments[index])) {
      return segments[at];
    }
  }
  return undefined;
}

// A valid UUID no row will ever have: the request that warms a template has to name some id.
export const TEMPLATE_ID = "00000000-0000-7000-8000-000000000000";

export const SHELL_CACHE = "app-shell";

export const SHELL_RSC_CACHE = "app-shell-rsc";

// next-intl prefixes the default locale and leaves an already-prefixed path alone (T-01).
export function rewrittenPath(pathname: string): string | null {
  const [, first] = pathname.split("/");
  return isAppLocale(first) ? null : `/${DEFAULT_LOCALE}${pathname}`;
}

export const WARM_SHELL_MESSAGE = "ledger-flow-warm-shell";

// F-54: the page has no other way to know the warm ended.
export const SHELL_WARMED_MESSAGE = "ledger-flow-shell-warmed";

export interface WarmShellMessage {
  type: typeof WARM_SHELL_MESSAGE;
  urls: string[];
}

function withoutLocale(pathname: string): string {
  const locale = localeOf(pathname);
  return locale === DEFAULT_LOCALE ? pathname : pathname.slice(locale.length + 1);
}

// P-33 (owner, 2026-09-08): with no network nothing on the server runs, so the worker answers.
export function isLandingPath(pathname: string): boolean {
  return withoutLocale(pathname) === "/" || pathname === "/";
}

export function isShellPath(pathname: string): boolean {
  const segment = withoutLocale(pathname).split("/")[1] ?? "";
  return (APP_SEGMENTS as readonly string[]).includes(segment);
}

// `/accounts/<uuid>` and `/shared/groups/<uuid>` become their template; every other path is itself.
export function templatePath(pathname: string): string {
  const segments = pathname.split("/");
  const at = localeOf(pathname) === DEFAULT_LOCALE ? 2 : 3;
  if (!(APP_SEGMENTS as readonly string[]).includes(segments[at - 1] ?? "")) return pathname;
  const id = segments.findIndex((segment, index) => index >= at && isEntityId(segment));
  if (id === -1) return pathname;
  return [...segments.slice(0, id), "[id]", ...segments.slice(id + 1)].join("/");
}

// F-06 with F-48: query strings and row ids change the URL, not the document behind it.
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
