# Decisions

Lightweight ADR log. One entry per non-obvious choice: date, decision, alternatives, consequence.
The specification that these decisions refine lives outside the repo in
`../auditoria/diseno/HANDOFF.md`, `../auditoria/diseno/DESIGN.md` and
`../auditoria/FASE-2-CONTRATO-FRONTEND.md`.

## 2026-09-01 · Rebuild from scratch on `redesign/fase-2` (W-01)

- **Decision:** the previous client was removed in one reset commit; nothing was copied. Only the
  design tokens, the Geist fonts and the `front-guardrails/` files enter from outside.
- **Alternatives:** incremental migration of the old code. Rejected in HANDOFF §2 (≈5 % would survive).
- **Consequence:** the old code stays readable with `git show audit/fase-2-frontend:<path>` for
  behaviour reference only.

## 2026-09-01 · Node 24 and "latest stable" with three documented exceptions (W-01)

- **Decision:** Node `24.x` (Vercel's default LTS today) in `engines`, `.nvmrc` and the Vercel
  project. Every dependency is installed at its latest stable version except:
  - `typescript` stays on 5.x: `typescript-eslint` declares `typescript <6.1`, and TypeScript 7
    (the Go port) is not yet supported by the lint toolchain.
  - `@types/node` stays on 24.x so the types match the runtime in `.nvmrc`.
  - `eslint` stays on 9.x: `eslint-plugin-react` (shipped by `eslint-config-next`) crashes on
    ESLint 10 (`context.getFilename is not a function`).
- **Consequence:** `npm outdated` lists exactly these three packages. Renovate carries matching
  `allowedVersions` rules; each exception is re-evaluated when the blocker ships.

## 2026-09-01 · Token files copied without their Spanish comments (W-01)

- **Decision:** `tokens/*.css` carry the exact values of `auditoria/diseno/tokens` (verified by a
  whitespace-and-comment-insensitive diff) but the explanatory Spanish comments were dropped.
- **Why:** HANDOFF §3.0 forbids comments and non-English text in the repo; §0 of DESIGN.md protects
  the values, not the prose. `tokens/` is excluded from Prettier so the files stay diffable
  against the design source.

## 2026-09-01 · Contrast check treats feature solids as informational (W-01)

- **Decision:** `tools/contrast-check.mjs` fails on every text pair below WCAG AA in both modes but
  only reports the `solid / surface` pairs of the 16 feature colors.
- **Why:** DESIGN.md §2.3 declares the solid role decorative and always accompanied by an icon or a
  label; the design's own tool already accepted failures for the light hues. Enforcing 3:1 on
  solids would reject the demo palette "Brisa" (orange 2.80, green 2.89) for no accessibility gain.

## 2026-09-01 · Bundle budgets measure route-owned JS on top of the framework runtime (W-01)

- **Decision:** `npm run size-limit` reads Turbopack's `build-manifest.json` (shared runtime) and
  each route's `page_client-reference-manifest.js` and enforces the HANDOFF budgets (landing
  ≤ 60 kB, app shell ≤ 200 kB gz) on the JS that the route adds beyond the shared runtime, which is
  reported separately.
- **Why:** an empty Next 16 App Router page already ships 126.7 kB gz of React + Next runtime, so a
  60 kB total is unreachable without leaving Next. The `size-limit` npm package cannot attribute
  chunks to App Router routes, and Next 16 no longer prints per-route sizes.
- **Consequence:** the runtime figure is visible on every CI run; whether the owner wants a total
  budget instead is raised at gate F1.

## 2026-09-01 · Lint enforces the hard rules mechanically (W-01)

- `react/jsx-no-literals` (children) plus `eslint-plugin-i18next` (`aria-label`, `title`,
  `placeholder`, `alt`, `label` attributes) implement "no user-visible text outside `messages/`".
- `no-restricted-globals`/`no-restricted-properties` ban `fetch` everywhere except `lib/api/**`
  and `app/api/**` (the BFF route handlers, which call the backend through `lib/api`).
- `eslint-plugin-boundaries` enforces `app → features → components/ui | lib` and forbids one
  feature importing another.
- `lint-staged` is not installed: `lefthook` already passes `{staged_files}` to each tool.

## 2026-09-01 · `messages/*.json` are nested by feature (W-01)

- **Decision:** nested objects (`transactions.list.empty.title`), one file per locale.
- **Why:** `next-intl` namespaces map to the first level, so a feature can load only its subtree;
  flat keys would need a custom loader for the same result.

## 2026-09-01 · Renovate commits reference W-01 (W-01)

- Dependency updates are platform work, so Renovate's `commitMessageSuffix` is `(W-01)` to satisfy
  the `commitlint` `references-empty` rule and keep one convention in the log.

## 2026-09-01 · Playwright stays the e2e tool; CI is its authoritative runner (W-01)

- **Context:** the development machine is WSL (Debian 13) without the Chromium system libraries
  and without password-less `sudo`, so `npx playwright test` cannot launch a browser locally until
  the owner runs `sudo npx playwright install-deps chromium` once.
- **Decision:** keep Playwright (HANDOFF §3.12); the `e2e` job in `ci.yml` installs the browser
  with its dependencies and runs against a backend with a single-node Mongo replica set started via
  `docker run` (service containers cannot pass `--replSet`).
- **Consequence:** local runs of `npm run test:e2e` are optional; every PR runs the suite in CI.
  The `e2e` job needs the `BACKEND_REPO_TOKEN` secret to check out the backend.

## 2026-09-01 · `subject-case` allows the `(W-nn)` reference (W-01)

- **Decision:** `commitlint` rejects Sentence/Start/Pascal/UPPER case subjects instead of requiring
  a fully lower-case subject.
- **Why:** the copied rule `subject-case: lower-case` rejected every subject that ends with the
  mandatory `(W-01)` reference because of the capital `W`. The intent (no capitalised subjects) is
  preserved; the reference format from `CLAUDE.md §5` stays valid.

## 2026-09-01 · Theme-color follows the live `--bg` token (W-02)

- **Decision:** `<meta name="theme-color">` is written at runtime from the computed value of `--bg`
  after the palette or mode changes, instead of a static `media`-split pair.
- **Why:** a static meta needs literal colors, which HANDOFF §3.0 forbids outside `tokens/`, and a
  per-palette hex table would duplicate the OKLCH seeds. The computed value already reflects the
  palette, the explicit mode and `light-dark()`.
- **Consequence:** the very first paint uses the browser default until hydration; the inline theme
  script still prevents the page itself from flashing.

## 2026-09-01 · Theme script through `next/script` `beforeInteractive` (W-02, revised in W-10)

- **Decision:** `THEME_INIT_SCRIPT` is served by the route `GET /theme-init.js` (static, cached one
  hour) and loaded with `<Script src="/theme-init.js" strategy="beforeInteractive" nonce>` in the root
  layout. It was first inlined as the Script's children, but React re-renders the root layout on the
  client for the not-found boundary and warns about inline script children; an external blocking
  script keeps the before-paint guarantee without that warning.
- **Why:** HANDOFF §3.7 requires the attributes before the first paint and §3.9 forbids
  `dangerouslySetInnerHTML`. `next/script` injects the inline code in `<head>` and will receive the
  CSP nonce from `proxy.ts` in W-07. `<html suppressHydrationWarning>` covers the attributes the
  script adds before React hydrates.

## 2026-09-01 · Geist through `next/font/local`, mapped onto the font tokens (W-03)

- **Decision:** the two variable fonts from `auditoria/diseno/preview/assets/fonts` live in
  `app/fonts/` and are declared with `next/font/local` (`--font-geist-sans`, `--font-geist-mono`).
  `app/globals.css` re-points the token stacks `--font-sans`/`--font-mono` at those variables.
- **Why:** `next/font` self-hosts, preloads and adds size-adjusted fallbacks (CLS ≈ 0) but names the
  family itself, so the token stack must reference its variable instead of the literal "Geist".
  `tokens/base.css` stays byte-identical to the design source.
- **Note:** the files are used as delivered (≈70 kB each, already close to a Latin subset); no
  subsetting tool is available on the build machine and the gain would be marginal.

## 2026-09-01 · Category icon keys are typed locally until the OpenAPI types exist (W-03)

- **Decision:** `lib/icons/category-icons.ts` maps the 105 keys of DESIGN.md §4.3 to Lucide
  components by name (tree-shakeable) and derives `CategoryIconKey` from that object. Unknown or
  empty keys render `hash`.
- **Consequence:** W-06 adds a contract test asserting that the generated `CategoryIcon` enum in
  `types/api.d.ts` equals `CATEGORY_ICON_KEYS`, so the two lists cannot drift.

## 2026-09-01 · Locale routing and formatting (W-04)

- **Routing:** `next-intl` with `localePrefix: "as-needed"` (`/` English, `/es/...` Spanish) through
  `proxy.ts`. Detection order is the library's: URL → cookie `lf_locale` (SameSite=Lax, set by the
  BFF from `user.locale` and by Settings) → `Accept-Language` → `en`. The `[locale]` layout is the
  root layout and renders `<html lang>` on the server.
- **Fallback:** a key missing in `es.json` renders the English text and logs a warning only in
  development (`getMessageFallback` walks `en.json`). `lib/i18n/messages.test.ts` fails the build
  when the two dictionaries differ in keys or ICU arguments, so the fallback is a safety net, not a
  workflow.
- **Format locale:** `formatLocaleFor(locale, navigator.language)` maps `es → es-CO`, `en → en-US`
  unless the device shares the language and adds a region. It is read through
  `useSyncExternalStore` with a `null` server snapshot, so SSR always formats with the default
  region and the client corrects it after hydration.
- **Money and dates:** `lib/format` holds the pure functions (`Intl.NumberFormat`, `date-fns-tz`
  `fromZonedTime` for `[from, to)` windows); `useMoney()`/`useDates()` in `lib/i18n` bind them to the
  `FormatSettingsProvider` (currency and time zone, defaulting to the backend defaults COP and
  America/Bogota until the session provider feeds the user's values in W-08).
- **Messages scope:** `en.json`/`es.json` carry the F1 screens (access, onboarding, home, settings,
  system states) plus shared enums. Each later backlog item adds its own subtree in both files; the
  parity test keeps them aligned. `es.json` complete is a gate F5 criterion.
- **Server time zone:** `getRequestConfig` uses `America/Bogota` for server-rendered dates until the
  user's zone is known per request.

## 2026-09-01 · `next/root-params` instead of `setRequestLocale` (W-04)

- **Decision:** `lib/i18n/request.ts` reads the locale with `rootParams.locale()` (stable in Next
  16.3) and falls back to the explicit `locale` override that `getTranslations({ locale })` passes.
  Pages and layouts no longer call `setRequestLocale`, which next-intl 4.14 marks as deprecated.
- **Consequence:** the generated `.next/types/root-params.d.ts` must exist before `tsc`, so the
  `typecheck` script runs `next typegen` first and `lefthook.yml` calls `npm run typecheck`
  (the only adaptation to the copied guardrail). Route Handlers and Server Actions cannot read root
  params: BFF handlers that need copy must pass `{ locale }` explicitly.

## 2026-09-01 · UI component conventions (W-05)

- **Feature color** is applied with inline custom properties (`featureColorStyle(token)` sets
  `--f`, `--f-soft`, `--f-text`, `--f-border`) instead of 16 `.color-<TOKEN>` classes: no extra
  CSS, the token stays typed, and children keep using `bg-(--f-soft)` exactly as `ui.css` does.
- **Variants over booleans:** `variant`, `size`, `tone` unions; `className` only for outer layout.
  Lists compose `Row` + `RowBody` + `RowTitle` + `RowMeta` + `RowRight` rather than one component
  with a dozen props.
- **`AmountInput` is uncontrolled** (`defaultValue` + `onChange`): the typed text must survive
  intermediate states such as `1.284,` that do not parse yet. A parent resets it by changing `key`.
  It decides `inputmode` from the currency's minor unit and parses with the format locale, so
  `1.284.300,50` works in Spanish.
- **Sheet** wraps the native `<dialog>` (`showModal`, Escape via `cancel`, scrim click). jsdom
  lacks the dialog API, so `vitest.setup.ts` polyfills `showModal`/`close` for tests.
- **Toast** is a single-slot provider (`useToast().show`) with `aria-live="polite"`, one action and
  a 5 s timer, as DESIGN.md §7.13 specifies; a queue was not needed.
- **Type scale** is bridged into Tailwind (`text-sm` → `--fs-sm`) from `app/globals.css`, so the
  `tokens/` files stay untouched while components use the standard utilities.
- **`/dev/ui`** lives under `app/[locale]/dev/ui` behind the `componentCatalog` flag (false in
  production) and uses the `dev` message namespace; it doubles as the manual check for W-02
  (palette and mode switch without reload).

## 2026-09-01 · Generated API types and the HTTP client (W-06)

- **Types:** `types/api.d.ts` comes from `npm run gen:api-types`, which extracts the OpenAPI
  document embedded in the backend's `swagger-ui-init.js` (there is no public JSON endpoint) and
  runs `openapi-typescript`. The backend views declare no `required`, so the generator marks every
  view property required except `User.reactivated`, `Category.seedKey` and `Session.userAgent`
  (documented in the script; reported to the backend in `TRACKING-R2.md`). CI regenerates the file
  and fails on a diff.
- **Enums:** `ColorToken` is the generated `Account.color` type; the runtime `COLOR_TOKENS` list is
  checked against it with `satisfies`, and `lib/api/contract.test.ts` asserts type equality for
  colors and the 105 category icon keys, so a backend change breaks the build instead of drifting.
- **Error codes** are not enumerated by the backend; `lib/api/errors.ts` owns the list and the
  presentation table (`scope` field/form/toast/screen/session/rateLimit + message key). Unknown
  codes keep `code: null` and fall back by HTTP status. Messages live under `errors.*`.
- **Client:** `api<T>(path, init)` always calls the same-origin `/api` proxy, sends `x-request-id`
  (UUID v7) and `Idempotency-Key`, times out at 15 s (`AbortSignal.timeout` combined with the
  caller's signal), wraps transport failures in `NetworkError`, retries exactly once with a fresh key
  on `422 IDEMPOTENCY_PAYLOAD_MISMATCH`, and delegates 401 to a pluggable handler that W-08 wires to
  the single-flight refresh. Responses are trusted to the generated types; no runtime validation.
- **Idempotency keys** come from `IdempotencyKeyring.keyFor(payload)`: one key per payload hash, so
  retrying the same body reuses it and editing the form after a failure rotates it.
- **Hook adaptation:** the pre-commit lint command passes `--no-warn-ignored` so staging the
  generated, lint-ignored `types/api.d.ts` does not fail the commit.

## 2026-09-01 · Session BFF, cookies and headers (W-07)

- **Cookie names:** `__Host-access` (15 min, `Path=/`, Strict) and `__Host-session` (30 days, `Path=/`,
  Lax, value `1`) follow HANDOFF §3.9. The refresh cookie is **`__Secure-refresh`** instead of
  `__Host-refresh`: the `__Host-` prefix requires `Path=/` (RFC 6265bis), and the handoff's own rule
  that the refresh token must never leave `/api/auth` matters more than the prefix. `__Secure-` still
  forbids non-HTTPS delivery and any `Domain` override.
- **`Secure` always on:** cookie prefixes require it, so the BFF sets it in development too. Browsers
  treat `http://localhost` as a secure context, which is why the app must be developed on localhost
  (or behind HTTPS), never on a LAN IP.
- **`GET /api/auth/me`:** the BFF decodes the access token payload (issued by our backend, verified
  there) to learn `userId` and proxies `GET /users/:id`. The client never receives tokens; a page
  reload gets the user from this endpoint.
- **Origin check:** every session handler compares `Origin` (or the `Referer` origin) with
  `NEXT_PUBLIC_APP_URL` and the request's own host; anything else is 403 before touching the backend.
- **Backend failures:** transport errors and the 15 s timeout become `503`/`504` JSON with
  `code: DB_UNAVAILABLE`, so the client shows the maintenance state instead of a raw 500.
- **CSP** is emitted in report-only mode from `proxy.ts` with a per-request nonce (also passed to the
  theme script through the `x-nonce` request header); reports go to `/api/csp-report`, which only
  logs them for now (Sentry takes over in W-35). `unsafe-eval` is added only in development for
  Turbopack HMR. Static headers (nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP,
  X-Frame-Options) come from `next.config.ts`; HSTS with preload only in production builds.
- **Route protection** lives in `proxy.ts` and reads only the `__Host-session` marker; the public
  surface is listed in `lib/auth/routes.ts`, guests are redirected to the localized login with a
  same-origin `next`, and signed-in users are bounced away from `/login` and `/register`.

## 2026-09-01 · Single-flight refresh and multi-tab session (W-08)

- **One refresh per tab, one per device:** `refreshSession()` shares a module-level promise and runs
  inside `navigator.locks.request("lf-refresh")` when the API exists (falls back to the promise
  alone). A 401 whose request started before the last successful refresh is retried without a new
  refresh (`since` check), and `session:refreshed` messages from other tabs update that timestamp,
  so two expired tabs never rotate the same token. `/auth/*` calls are exempt from the handler.
- **`BroadcastChannel("lf")`** (`lib/session/channel.ts`) carries `session:expired`,
  `session:logout`, `session:refreshed`, `theme` and `locale`. The theme store posts on every
  persisted change and applies remote changes without persisting them again; `SessionProvider`
  consumes the rest.
- **Session state** lives in React Query (`["session","me"]` → `GET /api/auth/me`) under
  `lib/session/SessionProvider`, per HANDOFF §3.4 (small contexts in `lib`, no global store). Logout
  and logout-all clear the QueryClient, delete every `lf-cache-*` IndexedDB database (the future
  per-user persisted cache) and notify the other tabs. `status: "expired"` is what W-10 renders as the
  blocking session sheet.
- **QueryClient defaults:** `staleTime` 30 s, `retry` once only on 5xx/429/network errors with
  exponential backoff plus jitter (cap 8 s), mutations never retry, refetch on focus.

## 2026-09-01 · Generic API proxy (W-09)

- `app/api/[...path]/route.ts` replaces per-endpoint handlers: it forwards method, query string,
  raw body, `Idempotency-Key`, `x-request-id` and `User-Agent`, attaches the Bearer token from the
  `__Host-access` cookie and streams the backend response back unchanged with `X-Robots-Tag:
noindex, nofollow` and `cache-control: no-store`. Mutations require a trusted `Origin`; bodies are
  capped at 64 kB (the backend caps at 10 kB anyway).
- The session endpoints (`auth/login|register|refresh|logout|logout-all|me`) are blocked in the proxy
  (their dedicated handlers win in routing, the block is defence in depth); `auth/sessions` is
  proxied because it only needs the access token.
- A missing access cookie answers 401 without touching the backend, which is what triggers the
  client's single-flight refresh.

## 2026-09-01 · App shell, routes and base states (W-10)

- **`/home` is the authenticated home.** HANDOFF §3.2 puts Inicio at `(app)/page.tsx` while §3.13
  reserves `/` for the static landing; both cannot own `/`. The landing keeps `/` (indexable, static)
  and the app starts at `/home`; guests hitting any app route are redirected to `/login?next=…`.
- **Shell composition:** `components/shell` is presentational (Sidebar, TabBar with the FAB slot,
  PageHeader, ConnectionBanner, SessionExpiredSheet, AppShell with skip link). Data enters through
  `app/[locale]/(app)/AppFrame.tsx`, a client component in the app layer that wires
  `SessionProvider`, `ToastProvider`, the pending-count hook and the redirects, so `components/shell`
  never imports a feature.
- **Connectivity** lives in `lib/network/connectivity.ts`, an external store fed by the
  `online`/`offline` events (W-19 adds the `/api/health` heartbeat); the banner shows the amber offline
  strip and a 3 s green "back online" strip, as DESIGN.md §8.12 asks.
- **Real 404:** `app/[locale]/[...rest]/page.tsx` calls `notFound()` outside the `(app)` streaming
  boundary, so unknown URLs return HTTP 404 with the localized not-found screen. Detail routes fetch
  on the client and render their own "not found" empty state (the HTTP status of a client-rendered
  shell is 200 by design).
- **Temporary stubs:** the routes the shell links to but that later backlog items build
  (`/transactions`, `/budgets`, `/accounts`, `/stats`, `/categories`, `/settings`,
  `/transactions/new`) exist as pages that call `notFound()`, because `typedRoutes` rejects links to
  unknown routes. They stream inside `(app)`, so they answer 200 with the not-found screen until they
  are replaced (W-15 replaces `/settings`, F2–F4 the rest).
- **`GET /api/dev/login`** (development only, `devLogin` flag) logs in with query credentials and
  redirects, so headless screenshots of authenticated screens are possible without driving a browser.
  It reuses the login handler and is a 404 outside development.
- **`/dev/frame?w=390&url=…`** (development only) embeds the app in a fixed-width iframe, because
  Windows browsers refuse windows narrower than ~480 px and headless screenshots at phone width
  were being cropped. To allow it, development sends `X-Frame-Options: SAMEORIGIN` and
  `frame-ancestors 'self'`; production keeps `DENY` / `'none'`.

## 2026-09-01 · Login (W-11)

- **Validation messages are message keys.** Zod schemas emit keys such as `validation.email`; the
  form translates them with `validationMessage(t, error.message)` (`lib/i18n/validation.ts`), so the
  schema stays free of copy and both languages come from `messages/`.
- **429 in the UI** shows the countdown from `Retry-After` (falling back to the 15-minute window) and
  disables the button until it reaches zero. The Playwright suite covers success and the uniform
  401 message only: reproducing the limit needs ten failed logins, which would also exhaust the
  per-IP budget of the CI backend for every later test, so the countdown is covered by a Testing
  Library test with a mocked 429 (the mocks-as-fallback rule of HANDOFF §3.12).
- **"Forgot your password?"** is rendered inactive with "(soon)" behind the `forgotPassword` flag
  until the backend has email delivery (TRACKING-R2 future tasks).
- **Element boundaries** now match full paths (`partialMatch: false`): the previous tail matching
  classified `features/*/components/*` as `components/ui`.

## 2026-09-01 · Registration (W-12)

- **Consent is front-end only** (owner decision, HANDOFF §3.18): the checkbox is required by the Zod
  schema and the button stays disabled until it is checked, but the flag is never sent to the backend.
- **Detected defaults:** currency comes from the device language's region through a small
  region→currency table (`lib/format/currency.ts`, fallback COP); the time zone from
  `Intl.DateTimeFormat().resolvedOptions().timeZone`. Detection runs through `useSyncExternalStore`
  with a `null` server snapshot, so the server renders empty pickers and the client fills them
  without a hydration mismatch. Both pickers are searchable sheets over `Intl.supportedValuesOf`
  with names from `Intl.DisplayNames`, never native selects.
- **Email enumeration** (409 shown inline with a sign-in link) is the accepted risk recorded in
  TRACKING-R2 (R2-44); the 500 case suggests signing in first, as the contract §A asks.
- **`reactivated: true`** skips onboarding and lands on home with `?reactivated=1`, which W-14 renders
  as the "Welcome back" info alert.
- **Route placeholders:** `/onboarding` (W-13) and `/privacy` (W-31) exist as `notFound()` stubs
  because the register flow links to them and `typedRoutes` requires known routes.
