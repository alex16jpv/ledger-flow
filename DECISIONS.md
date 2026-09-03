# Decisions

Lightweight ADR log. One entry per non-obvious choice: date, decision, alternatives, consequence.
The specification that these decisions refine lives outside the repo in
`../auditoria/front/diseno/HANDOFF.md`, `../auditoria/front/diseno/DESIGN.md` and
`../auditoria/front/FASE-2-CONTRATO-FRONTEND.md`.

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

- **Decision:** `tokens/*.css` carry the exact values of `auditoria/front/diseno/tokens` (verified by a
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

- **Decision:** the two variable fonts from `auditoria/front/diseno/preview/assets/fonts` live in
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
  (documented in the script; reported to the backend in `auditoria/front/BACKEND-DESDE-FRONT.md`). CI regenerates the file
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
  TRACKING-R2 decision R2-44; the 500 case suggests signing in first, as the contract §A asks.
- **`reactivated: true`** skips onboarding and lands on home with `?reactivated=1`, which W-14 renders
  as the "Welcome back" info alert.
- **Route placeholders:** `/onboarding` (W-13) and `/privacy` (W-31) exist as `notFound()` stubs
  because the register flow links to them and `typedRoutes` requires known routes.

## 2026-09-01 · Onboarding is composed in the app layer (W-13)

- **No `features/onboarding`.** The two steps are an `AccountForm` owned by `features/accounts`
  (reused by W-23) and a `GlobalBudgetForm` owned by `features/budgets`; the step flow and the
  redirects live in `app/[locale]/(auth)/onboarding/OnboardingFlow.tsx`, because a feature must not
  import another feature (HANDOFF §3.1). `AuthFrame`/`AuthHeading` moved to `components/shell` and
  `StepDots` to `components/ui` for the same reason.
- **Global budget name:** the backend requires a name, so the onboarding budget is created as the
  localized "Monthly budget" (`budgets.global.defaultName`) with the brand-like INDIGO color.
- **Suggestions** scale with the currency's minor unit (zero-decimal currencies suggest
  1.5M/2M/3M, others 1,500/2,000/3,000); the owner can refine the heuristic at the gate.
- **Idempotency:** accounts and budgets creation do not send `Idempotency-Key` because the backend
  only honours it on transactions; duplicates are caught by the backend's 409/400 rules.

## 2026-09-01 · Home skeleton with real data (W-14)

- **`features/home` owns its queries** (`home.*` keys over `/stats/spending`, `/accounts`,
  `/budgets`) instead of importing the accounts and budgets features: HANDOFF §3.3 already lists
  `home` as its own invalidation domain, and a feature must not import another.
- **Derived display values:** the server stays the source of money truth (`spent`, `total`, balances,
  `amount`), but the screen shows two figures the API does not expose: the daily average
  (`total / dayOfMonth`) and the total balance (sum of active account balances), both mandated by
  DESIGN.md §8.1. They are computed only for display and never sent back.
- **CTAs open the real forms:** "Create your first account" and "Create a monthly budget" open
  `AccountForm` and `GlobalBudgetForm` in sheets composed by `app/[locale]/(app)/home/HomeScreen.tsx`
  (the app layer may compose several features); closing invalidates the home queries.
- **Month window** comes from `useMonthContext` (`[from, to)` in the user's zone, day of month, days
  in month and yesterday's key) so stats and budgets use the same boundaries as the backend.

## 2026-09-01 · Minimal settings (W-15)

- **Language change** does `PUT /users/:id { locale }`, updates the session user, posts a `locale`
  message to the other tabs and navigates to the same path under the other prefix; the next-intl
  middleware refreshes the `lf_locale` cookie on that navigation, so the choice survives reloads and
  follows the user to other devices through `user.locale`.
- **"Follow device"** has no backend value (`user.locale` is `en|es`), so it is a local mode
  (`lf.localeMode`) that resolves `navigator.language` to a supported locale and saves that locale
  exactly like a fixed choice; the row stays checked while the mode is "device".
- **Palette cards** show five sample dots per palette from `tokens/samples.css` (brand + four seeds):
  the palette files select on `:root[data-palette]`, so an inactive palette cannot be previewed with
  the live tokens without duplicating its seeds. Adding a palette means adding its five samples.
- **Rows without a destination yet** (currency, time zone, categories, credentials, sessions, delete
  account) render as static rows with their live values (counts from `/categories` and
  `/auth/sessions`); W-30 and W-25 make them navigable. Export/import stay "soon".
- **Settings pages** use the narrow 640 px column of DESIGN.md §6 through `AppShell narrow`.

## 2026-09-01 · Brisa is the default palette (owner decision, W-02 revised)

- The owner chose **Brisa** as the default palette after gate F1; Tinta stays available as the second
  option. `DEFAULT_PALETTE` is `brisa`, the root layout renders `<html data-palette="brisa">` and the
  init script writes the default when nothing valid is stored, because `palette.tinta.css` still owns
  the attribute-less `:root` selector (the token files are copied verbatim from the design).

## 2026-09-01 · Local e2e runs on a dedicated test stack (owner request P-01)

- **Decision:** `npm run test:e2e` starts `tools/e2e-backend.mjs`, which seeds and runs the sibling
  backend on port 3200 against `mongodb://localhost:27017/lag_money_test` (the Docker replica set of
  the backend repo, with relaxed rate limits), and serves this app as a production build on port 3002
  with `API_URL` pointing at it. Specs read the base URL from `E2E_APP_URL`. CI keeps its own backend.
- **Why:** the owner's local backend points at Mongo Atlas, where they test by hand; e2e users must
  never land there. Next 16 also allows a single `next dev` per directory, so the e2e front cannot be
  a second dev server.
- **Consequence:** specs create `e2e-*@ledgerflow.test` users only in `lag_money_test`; the seed user
  is available there too. Port 3100 is taken by the backend's Mongoku container, hence 3200.

## 2026-09-01 · Pickers (W-16)

- **Recent categories come from stats, not from a local history.** `useRecentCategories` asks
  `GET /stats/spending?groupBy=category` for the trailing 90 days in the user's zone and ranks the
  buckets by `count` (ties by `total`), keeping the three that exist in the picker's list. The
  server stays the source of truth and the strip works on any device; `TRANSFER` has no stats
  endpoint, so transfer pickers show no strip.
- **The category list is filtered server-side by the movement type** (`?type=`) and paged through
  `nextCursor` until `hasMore` is false (the backend caps a user at 200 categories, above the
  100-item page).
- **"New category" lives inside the sheet.** The sheet swaps its body for `CategoryQuickForm`
  (name prefilled with the search text, icon grid, color) and selects the created category on
  success, so the transaction form underneath is never unmounted. The type is inherited from the
  picker and not editable there.
- **Date and time are native inputs** (`DateTimeField`), the only exception HANDOFF §3.5 allows.
  The value is a pair `{ date, time | null }`; `dateTimeInstant()` combines the chosen day with the
  **current local time** when no time was typed (owner decision of 2026-09-01, replacing the
  design's local noon), so a movement logged for today lands at the moment it was captured.
  `FUTURE_DATE` mapping and `max` are the form's job in W-18.
- **Both pickers can create in place.** The account sheet mirrors the category sheet: a "New account"
  row swaps the body for the existing `AccountForm` and selects the created account (owner request).
- **The account sheet moves focus to a row.** `showModal()` focuses the first focusable element,
  which in a sheet is the close button, so Enter right after opening dismissed the account picker.
  An effect focuses the selected option (or the first one) as soon as the rows exist, even when the
  accounts arrive after the sheet opened; the category sheet keeps focus on its search field.
- **`/dev/pickers`** is a development-only screen under `(app)` (session, shell and React Query
  available) so the pickers can be exercised and tested end to end against the real API before any
  form uses them; it disappears with the `componentCatalog` flag in production.
- **`NEXT_PUBLIC_APP_ENV` selects the feature-flag environment.** The e2e front is a production
  build (`NODE_ENV=production`), which switched `componentCatalog` off and made `/dev/*` a 404 in
  the suite. The optional variable (default: `NODE_ENV`) lets `playwright.config.ts` build with
  `test` flags; production deployments never set it.
- **The category search carries `autofocus` and nothing more.** Desktop browsers honour it, so a
  keyboard user types straight away; mobile browsers ignore it on purpose, keeping the virtual
  keyboard closed so the Recent strip and the list stay visible until the user taps the field. The
  e2e spec tabs into the field when the browser did not focus it.
- **`IconGrid` searches by key.** The 105 keys are English words (`shopping-cart`), so the search
  matches on them; localized synonyms would need a copy table and are deferred until W-25.

## 2026-09-01 · Quick capture (W-17)

- **The sheet is composed in the app layer** (`app/[locale]/(app)/QuickAddSheet.tsx`), like the
  onboarding: it needs the category picker, the account picker and the transactions hooks, and a
  feature must not import another. `features/transactions` owns the mutation, the schema and the
  draft-to-URL helper; the app file only wires them together.
- **The FAB is a button, not a link.** `AppShell` takes `onAdd({ chain })`; the tab bar fires it on
  click and, after holding the button for 500 ms, with `chain: true`, which keeps the sheet open and
  clears the amount after each save (DESIGN.md §8.2 "registro en cadena"). The sidebar button always
  opens a single capture. `/transactions/new` stays the destination of "More details", which carries
  the typed amount, category, account and note as query parameters for W-18.
- **Details through a follow-up PUT.** `POST /transactions/quick` has no description field and
  always flags `pendingDetails`, so a `PUT /transactions/:id` right after writes the description and,
  whenever a category was chosen (with or without a description), clears the flag: the owner decided
  on 2026-09-02 (P-17) that a categorized quick expense is complete, not pending. A failing PUT does not undo the capture:
  the toast turns red and says the note was not added, and the row stays in the review inbox.
- **One `Idempotency-Key` per sheet opening**, rotated by payload through `IdempotencyKeyring`, so a
  retry after a network error reuses it and an edited amount gets a fresh one.
- **Query domains are shared.** `lib/query/domains.ts` lists the root key of every feature and
  `invalidateMoneyMovement()` refreshes transactions, accounts, budgets, stats and home after any
  money movement; each `features/*/keys.ts` derives its `all` from that table so the roots cannot
  drift apart.
- **Undo deletes.** The toast action calls `DELETE /transactions/:id` (the backend has no restore),
  then invalidates the same domains; a failed undo shows its own red toast.

## 2026-09-01 · Transaction form (W-18)

- **One form for the four types, composed in the app layer** (`TransactionForm.tsx`, like the
  quick-add sheet): the type segment only swaps the account section (source / destination / from-to
  with swap / one account plus increase-decrease) and hides the category for transfers and
  adjustments; amount, date, description, tags and note survive the switch. Switching type clears
  the category because the API rejects a category of another type.
- **Form values keep the user's mental model, `toTransactionInput` speaks the API's.** The form
  stores `accountId` for single-account types and `fromAccountId`/`toAccountId` only for transfers;
  the mapper derives the sides (an adjustment "decrease" is `fromAccountId`, "increase" is
  `toAccountId`) and sends explicit nulls for the unused side and category so the same payload
  works for `POST` and for the merging `PUT`.
- **Future dates are refused in the client too.** `isTooFarAhead` mirrors the backend's 24-hour
  rule (`FUTURE_DATE`) so the error appears inline before the request; the server code still maps
  to the date field if clocks disagree.
- **Tags are a `components/ui/TagsInput`.** Enter, comma or blur add a tag (trimmed, lowercased,
  without leading `#`, ≤ 50 chars, ≤ 30 tags, deduplicated) and Backspace on an empty field removes
  the last one; suggestions come from `GET /transactions/tags` through the form, never from the
  component.
- **Routes:** `/transactions/new` (optional draft in the query string, written by the quick-add
  sheet) and `/transactions/[id]/edit`. After saving or deleting they return to `/home` for now:
  the `/transactions` stub renders the root not-found page, which unmounts the app frame and its
  toast; W-19 switches the destination to the list. Delete confirms in a sheet and shows a toast
  without Undo because the backend has no restore.

## 2026-09-02 · Transactions list (W-19)

- **Filters are the URL** (`?period&from&to&type&account&category&uncategorized&tag&pending&source&q`);
  `parseFilters`/`serializeFilters` are the single translation and defaults are omitted so a plain
  `/transactions` is the current month. The search box debounces into `q`, so even the text survives
  a reload and can be shared.
- **Day totals and the summary come from `GET /stats/spending?groupBy=day`** (one call for
  expenses, one for income) instead of summing the loaded rows: the client never adds money, and the
  header of a day stays right even when its rows are still on a later page. Transfers and
  adjustments are not part of those totals, as in the backend.
- **Search is client-side over the loaded pages** and `#tag` narrows to tags, as DESIGN.md §8.5
  describes; a server search would need an endpoint the API does not have.
- **`INVALID_CURSOR` resets the infinite query** and shows "List refreshed" instead of silently
  serving page one again.
- **Connectivity is decided by a heartbeat, not by `navigator.onLine`.** Every failed request
  reports a suspicion; the heartbeat then probes `GET /api/health` (an unauthenticated BFF route that
  asks the backend's `/health/db`) and marks the app offline only when the probe fails. While
  offline it re-probes every 30 s and on focus, and feeds React Query's `onlineManager`, so queries
  pause but keep showing cached data under the banner. Changing a filter while offline still needs
  the route's RSC payload, so it fails until F6 adds the service worker and the persisted cache.
- **The list screen is composed in the app layer** like the other F2 screens: it needs account and
  category lookups and the pickers of two features; `features/transactions` owns the row, day list,
  summary, filters model and hooks.

## 2026-09-02 · Request budget (owner report P-16)

- **Closed sheets do not query.** The quick-add sheet, the category and account pickers and the
  filters sheet used to fetch accounts, categories and the recent-category stats as soon as they
  mounted, on every page; they now pass `enabled` from their `open` state (a picker with a value
  still loads its list to show the name), and the filters sheet mounts only while open. In the
  owner's local log 60 of 96 backend calls were `/stats/spending` from those idle sheets.
- **Reference data is fresh for five minutes.** Accounts, categories, recent categories and tags
  change only through our own mutations, which invalidate them, so a 30-second `staleTime` plus
  refetch-on-focus only produced traffic. Lists, totals and details keep the 30-second default.
- **Why it matters:** the backend limits 200 requests per 15 minutes per IP and every request
  arrives from the BFF, so the budget is shared; the fix on that side is tracked in
  `BACKEND-DESDE-FRONT.md`, and the local backend runs with `RATE_LIMIT_MAX=5000` meanwhile.

## 2026-09-02 · Transaction detail (W-20)

- **The detail reuses the list's vocabulary.** `transactionTitle` names the row and the hero the
  same way (description, then transfer route, then category, then "Quick expense"), and the delete
  confirmation is one `DeleteTransactionSheet` shared with the edit form, so both paths show the
  same warning and the same toast without Undo (the backend has no restore).
- **Lookups are queried, not embedded.** The API returns ids for category and accounts; the screen
  loads the (long-lived) accounts and categories lists, including archived ones, and falls back to
  "Unknown account" instead of failing when a lookup is missing.
- **"Complete" links to `/transactions/review?focus=<id>`**, the W-21 inbox; until then the route is
  a stub so the link type-checks.

## 2026-09-02 · Review inbox (W-21)

- **Each card owns its draft and its mutation.** `ReviewCard` keeps the chosen category and the
  description locally and calls `useUpdateTransaction(id)`; after "Done" the list query refetches and
  the card disappears, and the tab counter drops because the same invalidation covers
  `usePendingCount`. No optimistic removal: the row leaves only when the server confirmed.
- **Count and total come from one request.** `GET /transactions?pendingDetails=true&limit=1&includeSummary=true`
  (backend `11c0a67`) returns `pagination.total` and `summary.totalAmount`; `usePendingSummary` feeds
  both the shell counter and the inbox header, so the client still adds no money.
- **`?focus=<id>`** marks the card with the brand outline and scrolls it into view, which is how the
  detail's "Complete" link lands on the right item.

## 2026-09-02 · Save all in the review inbox (F-07, owner decision)

- **One request, per-item results.** `PATCH /transactions/batch` (backend `6b2cedc`) takes up to 100
  items, each with its own category and description, and answers `200 { updated, failed }` even when
  some items failed. The front sends exactly one request with an `Idempotency-Key`, removes the
  saved cards, keeps the failed ones with the error of their `code`, and shows "n saved · m with
  errors". N parallel PUTs were rejected by the owner as not being a batch at all.
- **Only cards with a category are included.** The confirmation sheet says how many save and how
  many stay pending for lacking a category; nothing is copied between cards.
- **Drafts moved from the card to the screen** (`Record<id, ReviewDraft>`) so the button can count
  and send them; a card without a draft shows the transaction's own values. The individual "Done"
  stays as it was.

## 2026-09-02 · Gateway secret and quick-add focus (owner reports P-18, P-19)

- **`API_SECRET` travels only server-side.** The backend's `gatewaySecretMiddleware` rejects every
  request without `x-api-secret` once the secret is configured, and fails closed in production
  without it. `backendFetch`, the single place that knows the backend URL, now adds the header from
  the optional `API_SECRET` server variable; the browser never sees it, in line with HANDOFF §3.15.
  Locally the variable stays unset because the local backend runs without a secret.
- **The amount input takes the focus itself.** `showModal()` moves the focus to the first focusable
  element (the close button) and browsers differ on honouring `autofocus` inside a dialog, so the
  quick-add sheet focuses the amount from an effect on every opening and on every chained reset.

## 2026-09-02 · Home complete (W-22)

- **Bars come from `groupBy=day` and the client only fills the gaps.** The API returns the days with
  spending; `dayBars` builds one bar per calendar day of the month in the user's zone with 0 where
  nothing was spent and marks today, as DESIGN.md §8.1 asks. No amounts are added.
- **Budget phrases derive from the server's `spent` and `amount`.** "left" and "over by" are
  differences of two server figures shown next to them, the same display-only derivation W-14 allowed
  for the daily average; the pace marker and the tone reuse `Progress`. The global monthly budget stays
  in the hero and is excluded from the list, which ranks the rest by share consumed.
- **Pending alert from one request.** Home has its own `pending` query on the same
  `includeSummary=true` listing the inbox uses, keyed under `home`, so a mutation invalidates both.
- **Recent movements are an app-layer slot.** `HomeView` renders `recent` where the design puts it;
  `RecentTransactions` (app layer) merges the pending rows first and the latest rows after, through
  `useRecentTransactions`, and reuses `TransactionRow` with the account and category lookups. A feature
  still never imports another.

## 2026-09-02 · Live grouping in `AmountInput` (owner decision P-20, W-05 revised)

- **The text is formatted while typing, the value stays clean.** `formatEditableAmount` rebuilds the
  field on every change from the digits the user owns: locale grouping for the integer part, the
  locale's decimal separator (kept visible while the fraction is still empty), fraction capped to the
  currency's digits, letters and foreign separators dropped, leading zeros removed. The parent keeps
  receiving a plain number or `null`; nothing formatted ever reaches the API.
- **The caret follows the digits, not the characters.** Before formatting, the caret position is
  translated into "units" (digits and the decimal separator before it) and placed after the same units
  in the new text, so inserting or deleting in the middle of `1,234,567` never jumps. Backspace or
  Delete on a grouping separator removes the neighbouring digit as well, otherwise the separator would
  reappear at once and the key would feel dead.
- **Still uncontrolled from the parent's point of view** (`defaultValue` + `key` to reset), as decided
  in W-05: the component owns the text; the parent owns the number.

## 2026-09-02 · Amount ceiling and server field details (P-21)

- **One ceiling, `MAX_AMOUNT = 1e13`, shared by the Amount editor and every Zod schema.** Amounts are
  stored as integer cents on the backend, so the largest exact value is bounded by
  `Number.MAX_SAFE_INTEGER / 100 ≈ 9e13`; 1e13 (ten trillion) keeps a margin and still covers houses in
  COP, IRR, VND or IDR. The editor stops at 14 integer digits and the schemas answer
  `validation.amountMax` before the request. The backend's own limit (1e9 today) is asked to move to the
  same figure in `BACKEND-DESDE-FRONT.md`; until then its `VALIDATION` lands on the field too.
- **Zod locations are stripped from `details[].field`.** The API reports `body.amount`; forms know
  `amount`. `fieldErrors` removes the `body.` / `query.` / `params.` prefix.
- **A server detail never shows raw.** `validationMessage` translates our keys and maps anything else to
  the generic `validation.invalid`, per HANDOFF §3.8.

## 2026-09-02 · Focus on entry (owner reports P-22, P-23)

- **The transaction form focuses the amount on mount and on every type switch.** The segment only
  reconfigures the account section, so after choosing Income or Transfer the next thing to type is
  still the amount; an effect keyed on the type moves the focus there.
- **`PickerSheet` focuses its search box from an effect**, like the account sheet does with its rows:
  `showModal()` lands on the close button and `autofocus` inside a dialog is not honoured
  consistently. The category sheet keeps its `autofocus` for now: its recent chips are the first
  target on touch screens, so the keyboard should not pop there by default.

## 2026-09-02 · Accounts (W-23)

- **One request for the whole list.** `/accounts` asks `includeArchived=true` once (a user is
  capped at 100 accounts, which is one page) and `summarizeAccounts` splits active and archived,
  puts the main account first and derives the summary card. The design fetched the archived ones
  on opening the section, but the count in the "Archived · n" header needs them anyway, and a
  second query only added traffic.
- **The summary card adds balances the server already computed.** Total balance and card debt
  (negative balances of `CARD`, `OVERDRAFT` and `LOAN`) are display aggregations of `Account.balance`,
  the same way the home screen sums its total; no money is derived from transactions in the client.
- **Restoring into a taken name cannot be fixed by renaming the archived account**: the backend
  rejects `PUT` on archived accounts (`RESOURCE_ARCHIVED`) and `POST /restore` takes no body. On
  `409 DUPLICATE` the detail opens `RestoreConflictSheet`, which names the active account holding
  the name (case-insensitive match over the loaded list) and links to its edit form; a one-step
  "restore with a new name" is requested in `BACKEND-DESDE-FRONT.md`.
- **Make main and archive are undoable from the toast** (DESIGN §8.12): undo promotes the previous
  main again, or restores the account just archived. Archiving stays on the detail, which turns into
  its archived state (Restore as the primary action, Edit hidden because the backend refuses it).
- **The account's transactions reuse the list feature.** The detail composes
  `useTransactionsInfinite({ accountId })` and `TransactionDayList` in the app layer, without day
  totals: the account list is not windowed by period, so there is no `[from, to)` to ask
  `/stats/spending` for. "Open with filters" hands the same filter to `/transactions?account=&period=all`.
- **The account mutations invalidate `accounts` and `home`** only: nothing moves money, and every
  screen resolves account names through the accounts list.
- **`AccountForm` gained an edit mode** (`account` prop): the balance field disappears (it is the
  immutable `openingBalance`), the payload becomes `PUT { name, type, color }`, and the preview card
  shows the account's real balance. The onboarding and the pickers keep using the create mode.

## 2026-09-02 · Adjust balance (W-24)

- **The delta is the one subtraction the client makes**, because the design shows it before saving:
  `adjustmentInput` computes `actual − recorded`, rounds it to the currency and books a decrease as
  `fromAccountId` or an increase as `toAccountId`; the server applies it to the balance. A zero delta
  disables the button instead of sending an empty adjustment.
- **The sign is a segmented control next to the amount.** `AmountInput` only edits digits, and debt
  accounts (cards, overdrafts, loans) live below zero, so "Positive / Negative (debt)" sets the sign
  and starts from the sign of the recorded balance. Adding a minus sign to `AmountInput` would have
  touched every form for one screen.
- **The sheet lives in the app layer** (`accounts/[id]/AdjustBalanceSheet.tsx`): it takes an account
  and posts a transaction, so it belongs to neither feature; it reuses `useCreateTransaction` with an
  `IdempotencyKeyring` like the full form. The adjustment is dated at the moment of saving.
- **Nothing is invalidated by hand**: the transaction mutation already refreshes accounts, home,
  transactions, budgets and stats, so the hero balance and the account's rows update on their own.

## 2026-09-02 · Categories (W-25) and tooltips (F-04)

- **One form for the picker and the pages.** `CategoryQuickForm` became `CategoryForm`: the picker
  passes a fixed type (`typeEditable={false}`) and no preview; `/categories/new` and
  `/categories/[id]/edit` add the live preview and the type segment. One component, one set of
  error mappings (`DUPLICATE` under the name, `CATEGORY_TYPE_LOCKED` under the type).
- **Usage counts come from three unbounded stats calls**, `GET /stats/spending?groupBy=category&type=…`
  for `EXPENSE`, `INCOME` and `TRANSFER` (omitting `from`/`to` aggregates the whole history). They
  feed "n transactions / unused" on the tiles and the type lock of the edit form: a category with
  history disables the segment before the API has to refuse, and the payload omits `type` so an
  unchanged type never trips `CATEGORY_TYPE_LOCKED`. The server error is still mapped in case the
  counts are stale.
- **The type tab lives in the URL** (`/categories?type=INCOME`), as every list filter does
  (HANDOFF §3.4); "New category" carries the current type into the form and saving returns to the
  tab of the saved category.
- **Archived categories are one folded list for all types**, not one per tab: a user who archives
  a category and switches tabs should still find it. Restore on a taken name opens the same kind of
  conflict sheet as accounts (the API refuses `PUT` on archived categories too).
- **Restore defaults reports the count from the response** (`data.length`): "n categories created"
  or "Nothing was missing"; archived defaults count as present on purpose, as the backend documents.
- **`Tooltip` is CSS-only and hidden from assistive technology** (owner request F-04): the swatches
  and the icon grid already expose their name through `aria-label`, so the bubble repeats it only
  visually on hover and keyboard focus (`group-focus-within`). No positioning library for a static
  label above a 28–40 px control.
- **Settings › Categories now links to `/categories`**; the remaining settings rows stay static
  until W-30.

## 2026-09-02 · Restore under a new name (W-23, W-25 revised)

- **The 409 sheet now renames and restores in one request.** The backend (`c027663`) made
  `POST /accounts/:id/restore` and `POST /categories/:id/restore` accept `RestoreInput { name? }`,
  renaming in the same write that clears `archivedAt`, so the earlier detour ("open the account that
  holds the name and rename it") is gone. `RenameRestoreSheet` (`components/ui`) is shared by both
  features: it names the active holder, prefills the archived name, disables the button until the
  name actually changes and shows a second `DUPLICATE` under the field.
- **Types regenerated** from the local `/api-docs.json`; `restoreAccount`/`restoreCategory` take the
  optional input and the mutations receive `{ id, name? }`.

## 2026-09-02 · Budgets list (W-26)

- **The month is the URL** (`/budgets?reference=YYYY-MM`, omitted for the current month) and the
  period-type filter too (`?period=WEEKLY`). The request sends the local start of that month as
  `reference`: any instant inside the month resolves the same period instance, and the local
  midnight is unambiguous across time zones.
- **The whole list is fetched following `hasMore`**, never `data.length`: the backend drops expired
  and pre-floor budgets after paginating, so a page can be short while more remain.
- **The global monthly budget is the featured card**; other global budgets (weekly, yearly…) list as
  regular cards. When it is missing the slot shows the dashed CTA, which opens the same
  `GlobalBudgetForm` the onboarding and the home use, so there is one way to create it.
- **Status phrases come from `budgetProgress`**: over 100 % → "Over by", ≥ 80 % → "fast pace",
  nothing spent → "nothing spent yet", CUSTOM → "ends in n days", closed period → "left at the end".
  Days left and the pace marker are computed against `periodFrom`/`periodTo` from the API; the
  client never sums transactions.
- **`/budgets/past` uses one request** with `includeExpired` and `includeArchived` and splits the
  tabs on the client. "Create again" points to `/budgets/new?from=<id>`, which W-28 implements.
- **Budget screens are composed in the app layer** (like transactions) because the tiles show the
  category icon of single-category budgets, which lives in `features/categories`.
- **Past budgets are not dimmed.** DESIGN §8.8 draws ended/archived cards at 85 % opacity, but that
  drops the secondary text below the 4.5:1 contrast axe enforces in every smoke, so the cards keep
  full opacity and rely on the "Ended" / "Archived" badge and their own tab.

## 2026-09-02 · Budget detail (W-27)

- **The detail navigates months like the list** (`?reference=YYYY-MM`) for every period type: the
  backend resolves the instance containing the local start of that month, so a weekly budget shows
  the week of the 1st. Finer navigation would need a period-aware stepper the design does not draw.
- **Overrides go to `PUT/DELETE /budgets/:id/amount?reference=`** with the same reference as the
  view; "Skip this period" is `amount: 0` (the API keeps it distinct from removing the override) and
  the card phrases the three states (base, adjusted to X, doesn't apply).
- **The period's transactions come from the list endpoint** with `from`/`to` = `periodFrom`/`periodTo`
  and `type`; a single-category budget adds `categoryId`, a multi-category one filters the first page
  on the client because the API takes one category. "See all" opens `/transactions` with a custom
  period (inclusive dates in the user's zone) and, when possible, the category.
- **Pace = spent ÷ elapsed days of the period** (at least one), computed from API values only.
- **Archiving is final** and needs the confirmation sheet with the danger copy; the archived detail
  keeps the hero and explains, without override or edit actions.

## 2026-09-02 · Budget form (W-28) and suggestions by currency (F-01)

- **The inclusive end date becomes the API's exclusive `periodEndDate`**: the user picks "Oct 1 –
  Oct 15" and the form sends the local midnight of Oct 16, because `resolvePeriod` treats the CUSTOM
  window as `[start, end)` like every other period; `effectiveFrom` is the local midnight of the date.
- **Native `<input type="date">` for the custom window and "Effective from"**: dates are the one
  control HANDOFF §3.5 lets stay native (as `DateTimeField` already does).
- **`PUT` only carries the period when it changed**, because the backend clears every override
  whenever `periodType` (or the CUSTOM dates) is written; the form warns before that happens.
- **"Create again" reuses the form with `?from=<id>`**: name, scope, categories, amount, color and
  note are copied; a CUSTOM window is re-based on today with the same length, and `effectiveFrom` is
  left empty so the new budget starts now.
- **Overlap errors are phrased by scope**: `BUDGET_PERIOD_OVERLAP` becomes "You already have a
  global {period} budget" or "Another {period} budget already covers one of these categories";
  `CATEGORY_ARCHIVED` / `CATEGORY_TYPE_MISMATCH` land under the categories field.
- **Suggestions follow the currency's scale or the user's spending (F-01).** `budgetSuggestions`
  looks up a per-currency table (COP, MXN, CLP, JPY, IDR…) instead of the decimal count, and when
  the user spent something last month it offers 80 %, 100 % and 120 % of that, rounded to a
  friendly figure (`roundToNice`). The global-budget form shows "Based on last month's spending" in
  that case; the onboarding keeps the currency table since a new user has no history.

## 2026-09-02 · Stats (W-29)

- **Everything is the URL** (`/stats?reference=YYYY-MM&type=&groupBy=`, defaults omitted), like the
  transactions filters and the budget month, so a view can be shared and survives a reload.
- **The summary card always uses the category grouping** for the transaction count (`Σ count`),
  even on the Days and Tags tabs: day buckets share the same total but tag buckets double count.
  When the tab is Categories it is the same cached query, so nothing extra is fetched.
- **Shares and averages are the only client arithmetic**: percentages divide each bucket by the API
  `total`, the daily average divides the total by the elapsed days of the month (the whole month for
  a past one). No transaction is summed in the client.
- **Days are filled with zeros in the user's zone** (`daySeries`), today is highlighted, and the bars
  are buttons that open the list for that day; the biggest day lists its transactions through the
  list endpoint with the day window and the flow type.
- **Tags exclude the `untagged` bucket from the rows** and surface it in the double-counting note
  instead, as DESIGN §8.9 asks.
- **Adjustments are opt-in** (`type=ADJUSTMENT`) with an explanatory note, matching the backend's
  exclusion by default; Export stays visible but disabled behind the `exportTransactions` flag.

## 2026-09-02 · The app formats with the user's currency and zone (owner report P-24, W-10 revised)

- **`FormatSettingsProvider` was mounted only at the root with its defaults** (COP, America/Bogota):
  no screen ever received `user.currency` / `user.timezone`, so a Los Angeles user in USD saw Bogota
  month boundaries and zero-decimal amounts. `AppFrame` now wraps the authenticated shell in a second
  provider fed from the session, and every `useMoney` / `useDates` consumer inherits it.
- **The budget month reference is noon on the 15th**, not the local midnight of the 1st. The backend
  resolves the period in the zone of the token; when the client's zone disagreed (the bug above) the
  midnight instant fell into the previous month and the list came back empty while the create call
  answered `BUDGET_PERIOD_OVERLAP`. Any instant inside the month is valid, and the 15th at noon is
  inside it in every zone.

## 2026-09-02 · Budgets can be restored (owner decision P-25, W-26/W-27 revised)

- **Archiving a budget is no longer final.** Past › Archived lists them, so the owner asked for
  restore like accounts and categories; the backend added `POST /budgets/:id/restore` (`1b1683f`).
  The archived detail and the Archived tab show **Restore**, the archive toast offers **Undo**, and
  the copy stops calling it final.
- **A restore that overlaps is refused, never adjusted.** The API applies the creation overlap rule
  on the way out (`BUDGET_PERIOD_OVERLAP`); per the owner, changing categories or period would make
  it a different budget, so `RestoreBudgetConflictSheet` names the active budget in the way
  (`findOverlapping`, the same rule mirrored on the client over the loaded list) and offers
  "Create again" or opening the other one.

## 2026-09-02 · Custom budgets belong to the months they touch (owner report P-27)

- **The current month is referenced with "now"**, past months with noon on the 15th. The API marks a
  CUSTOM budget `expired` as soon as `reference` passes its end, so a two-day window opened today was
  already "ended" when the list asked about the 15th; with "now" it stays in the month until it ends.
- **A CUSTOM budget is shown only in the months its window overlaps** (`overlapsMonth`, client-side).
  The API lists a one-shot window for every reference before its end, which put a September–October
  budget in June and July; recurring budgets are unaffected because the server already drops them
  before their lifetime floor.

## 2026-09-02 · One category per budget (owner decision P-28, W-28 revised)

- **The form selects a single category** (`BUDGET_CATEGORIES_MAX = 1`, chips behave like radios)
  even though the API accepts up to 20. A category can only sit in one budget per period type, so
  budgets with several categories collided with single-category ones in ways the overlap message
  could not explain; the owner chose the simplest rule. Existing multi-category budgets still render
  and edit (picking a chip replaces the selection).
- **CUSTOM overlap ignoring dates is a backend fix** (`BACKEND-DESDE-FRONT.md`): two custom windows
  for the same category that never touch are refused today; the front does not work around it.

## 2026-09-02 · Back with an in-app fallback (owner report P-26)

- **"Back" only goes back when the previous entry is ours.** `HistoryTracker` (mounted once in
  `AppFrame`) records the in-app URLs: a URL change with the same `history.length` is a replace, a
  `popstate` is a pop, anything else is a push. `useBackNavigation()(fallback)` calls
  `router.back()` when the stack has a previous entry and `router.replace(fallback)` otherwise, so a
  deep link or a reload lands on the list (`/accounts`, `/budgets`, `/categories`, `/transactions`)
  instead of leaving the app.
- **Saving an edit goes back, creating replaces.** After an edit the screen returns to the detail it
  came from (`back(detail)`), so the form never stays in the history and "back" from the detail
  reaches the place before the edit; after a create the blank form is replaced by the new detail.

## 2026-09-02 · Settings complete (W-30)

- **A credential change signs this device in again.** `PUT /users/:id` with `email` or `password`
  bumps the token version and revokes every refresh token, ours included; instead of letting the next
  refresh fail into the session-expired sheet, `useUpdateProfile` calls `/api/auth/login` with the new
  pair right after the update and the toast says the other devices were signed out.
- **Changing the time zone refreshes the access token immediately** (`refreshSession()`), because the
  backend resolves budget periods and stats days with the zone claim, and then invalidates every query.
- **"This device" is not marked in the sessions list yet**: neither token carries the session family
  id, so the client cannot tell its own row apart; requested from the backend
  (`BACKEND-DESDE-FRONT.md`). Every row offers "Sign out"; "Sign out all other sessions" uses
  `logout-all` and warns that this device signs out too.
- **The currency and time-zone pickers moved to `components/ui`** so the settings feature can reuse
  them without importing from `features/auth`.
- **Deleting the account** requires typing the localized word, calls `DELETE /users/:id`, signs out and
  lands on `/login?deleted=1`, which explains that registering again with the same email reactivates it.
- **Policy version is a constant (v1)** shown with the sign-up date: the backend records no acceptance
  (owner decision in HANDOFF §3.18); it will become a field the day a new version needs re-acceptance.

## 2026-09-02 · Public surface (W-31)

- **The app providers left the root layout.** `QueryProvider`, `ThemeProvider` and
  `FormatSettingsProvider` now live in `AppProviders`, mounted by the `(app)`, `(auth)` and `dev`
  layouts; the landing, the legal pages and the 404 render as server components inside `PublicFrame`
  with no React Query or shell code, which is what keeps the landing under its 60 kB budget and
  readable without JavaScript. The theme still applies through the inline init script and CSS.
- **The phone in the hero is HTML, not an image** (`PhoneMock`): the home composition with fixed
  sample figures formatted by `Intl` for the page locale; labels come from `public.mock` messages so
  the Spanish landing shows a Spanish phone.
- **Privacy doubles as the Ley 1581 data-processing policy** (section anchored as
  `#data-processing`, linked from every footer), and `/terms` shares the `LegalPage` template. Both
  are drafts for the owner to review before F5 closes, as HANDOFF §6 foresees.
- **404 is a real 404** rendered inside the public frame; `error.tsx` at the locale root covers the
  public pages with the same `Empty` composition.

## 2026-09-02 · Technical SEO (W-32)

- **One helper builds every public page's metadata** (`lib/seo.ts`): canonical, `hreflang` for
  `en`, `es` and `x-default`, Open Graph and Twitter card, all derived from `NEXT_PUBLIC_APP_URL`
  (`metadataBase` in the root layout); the domain never appears in code, as HANDOFF §3.17 requires.
- **`robots.ts` allows only the public surface** and disallows the BFF, the app routes and the dev
  screens in both locales; `sitemap.ts` lists the five public paths with their language alternates.
  The proxy adds `X-Robots-Tag: noindex, nofollow` to app and dev routes, on the redirect to login too.
- **The Open Graph image is rendered by `next/og`** from the landing copy of the requested locale.
  Satori cannot resolve CSS variables, so that file carries literal brand colors and is the one
  exemption in `check-tokens`.
- **JSON-LD only on the landing**: `Organization`, `WebSite` and `SoftwareApplication`
  (`FinanceApplication`, price 0), serialized by us and carried under the CSP nonce.

## 2026-09-02 · PWA (W-33)

- **Serwist builds the worker after `next build`, our code registers it.** Next 16 builds with
  Turbopack, which the `@serwist/next` webpack plugin cannot hook into, so `npm run build` runs
  `serwist build serwist.config.mjs` (the CLI bundles `app/sw.ts` with esbuild into `public/sw.js`,
  git-ignored) using `@serwist/next/config` to precache the Next output. The worker treats `/api/*`
  as network-only, since data lives in React Query's cache. No inline registration script (it could
  not carry the CSP nonce): `ServiceWorkerUpdates`, inside the authenticated frame and only in
  production, registers `/sw.js`, watches for a waiting worker and shows the "New version available ·
  Reload" toast, which activates it and reloads.
- **Icons are generated, not drawn by hand.** `lib/pwa/brand-icon.tsx` renders the mark with `next/og`
  for the favicon, the Apple touch icon and the 192/512 manifest icons; `?maskable=1` pads the mark
  into the safe zone. The manifest and the icon renderer carry literal brand colors (manifests and
  satori cannot read CSS variables) and join the `check-tokens` exemptions.
- **`theme-color` stays dynamic**: the theme script mirrors the live `--bg`, so no static meta is
  added; the manifest's `theme_color`/`background_color` are the Brisa light values. `viewport-fit:
cover` is set once in the root layout for the standalone display.
- **The install row shipped with W-30** (`beforeinstallprompt`); the manifest shortcut "Add expense"
  opens the transaction form.

## 2026-09-02 · Spanish complete and copy review (W-34)

- **`es.json` is at parity with `en.json` (908 keys)** and the existing parity test keeps it there.
  The values that are identical in both files are formats (`{date} · {time}`), proper names (Brisa,
  Bancolombia) and words spelled the same in Spanish (Color, Manual, Global); nothing is left in
  English by omission.
- **Month headings are capitalized** in `formatMonth`: `Intl` yields lowercase Spanish month names,
  correct in running text but weak as a standalone title ("agosto de 2026" → "Agosto de 2026").
  Eyebrows already render uppercase and day names inside sentences stay as `Intl` gives them.
- **SEO titles and descriptions exist in both languages** since W-32; the legal drafts are the copy
  still awaiting the owner's review before the F5 gate.

## 2026-09-02 · Observability (W-35)

- **Sentry behind `lib/observability`, never imported by the app.** `reporter.ts` is a tiny registry:
  `client.ts` reports 5xx and online network failures, the error boundaries report render errors, and
  `instrumentation-client.ts` registers the SDK as the reporter. The SDK loads with a dynamic import
  and only when `NEXT_PUBLIC_SENTRY_DSN` is set, so the e2e build never downloads it and the runtime
  chunk grew from 127 kB to 131 kB gz instead of the 216 kB a static import cost. Errors thrown before
  the SDK arrives are lost; accepted.
- **Nothing financial leaves the app.** `scrub.ts` runs as `beforeSend`/`beforeBreadcrumb` on every
  runtime: user, extras, headers, cookies and bodies are dropped, URLs keep only the path (search
  filters live in query strings), console breadcrumbs are discarded and numbers of four or more
  characters are redacted from messages. `sendDefaultPii` is off and tracing is off (0 %): Web Vitals
  go to Vercel Speed Insights, page views to Vercel Analytics (cookie-less, production only, paths
  only), both behind `lib/analytics`, as decided in HANDOFF §6.
- **Events tunnel through `/monitoring`** (`withSentryConfig`, a rewrite to the ingest host) so CSP
  keeps `connect-src 'self'`; the middleware matcher skips that path so next-intl does not swallow it.
- **`lib/env` stays out of the client instrumentation path.** `instrumentation-client.ts`,
  `sentry-options.ts` and `Analytics.tsx` read `process.env` directly: importing `env.ts` there pulled
  Zod into every page (the landing went from 30 kB to 120 kB gz). The variables are still validated by
  `env.ts` at build time through `next.config.ts`.
- **Every failed screen prints the `requestId`.** `LoadErrorBody` replaces the 18 inline
  `states.error.body` renders and adds "Reference: …" from `ApiError`/`NetworkError`; the BFF proxy
  logs one JSON line per call (`requestId`, method, path without query, status, duration, no body).
  The backend already echoes and logs the same id, so one search follows an error end to end (e2e
  `observability.spec.ts`).
- **Not done:** the `disableLogger` tree-shaking flag is not supported under Turbopack, so the
  SDK's debug logger ships (a few kB inside the lazy chunk). Source maps upload only in the deploy
  pipeline with `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` (W-36).
