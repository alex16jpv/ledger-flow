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

## 2026-09-02 · Deploy to preview and production (W-36)

- **Vercel stays the host and nothing about it lives in code.** `NEXT_PUBLIC_APP_URL` now falls
  back to `NEXT_PUBLIC_VERCEL_BRANCH_URL` and `NEXT_PUBLIC_APP_VERSION` to the short commit SHA, so
  previews need no per-branch variables; production sets the real domain and, later, the tag.
  Previews answer `x-robots-tag: noindex` on every response and a `robots.txt` that disallows all,
  because Vercel only adds its own header on `*.vercel.app` hosts.
- **Lighthouse CI is the fourth CI job**, running `lhci autorun` against a production build of the
  public pages (`/`, `/es`, `/login`, `/privacy`) with the HANDOFF thresholds as assertions and the
  reports kept as an artifact. The build for that job uses the audited origin as
  `NEXT_PUBLIC_APP_URL`: a canonical pointing elsewhere costs eight SEO points. The Spanish CTA
  changed from "Empezar" to "Crear cuenta gratis" because Lighthouse counts the former as generic
  link text, and the longer copy says where the link goes.
- **Releases are tags.** `CHANGELOG.md` (Keep a Changelog) starts at `0.1.0`, `package.json` carries
  the same version, and production deploys only from `vX.Y.Z`. The tag itself is not created here:
  it must point at the commit the owner merges after the F5 gate (owner's rule: no push, no deploy).
- **Not automated:** GitHub branch protection, the Vercel environment variables, the Sentry
  project and the `BACKEND_REPO_TOKEN`/`SENTRY_AUTH_TOKEN` secrets are console settings for the
  owner; the checklist lives in `auditoria/front/puertas/F5/README.md`.

## 2026-09-03 · One database per user holds both the mirror and the outbox (O-F1)

- **Decision:** the vault is a single IndexedDB database per user, `lf-vault-<userId>`, holding the
  five mirror stores, the `outbox` and `meta` together.
- **Alternatives:** two databases (`lf-vault-*` for the mirror, `lf-outbox-*` for the queue), which
  would make "dropping the mirror never drops the outbox" structurally impossible to get wrong.
  Rejected because **IndexedDB transactions cannot span two databases**, and O-F4 requires writing
  the entity and its operation in one transaction (plan §4.1) — that is the difference between a
  ghost movement and a saved one. Atomicity is a platform constraint; separation is a discipline we
  can enforce with code and tests, so the discipline gives way.
- **Consequence:** invariant 7 is protected by code, not by structure: nothing ever calls
  `deleteDatabase` on a vault, the mirror reset transaction deliberately does not include the
  `outbox` store, and both rules have a test that fails when they are broken.

## 2026-09-03 · Three version numbers, because the two halves migrate by opposite rules (O-F1)

- **Decision:** `VAULT_SCHEMA_VERSION` is the physical IndexedDB version and only ever creates
  stores and indexes. `MIRROR_VERSION` and `OUTBOX_VERSION` are logical, live in `meta`, and are
  reconciled on every open. Bumping the mirror clears it and drops the cursor, so the next pull is a
  full snapshot. Bumping the outbox runs an explicit migration per operation; if any operation
  cannot be carried forward, **nothing is written**, the vault reports `outbox: "blocked"` and the
  version stays where it was until the queue drains.
- **Alternatives:** doing both inside `upgradeneeded`. Rejected: a `versionchange` transaction
  cannot await outside work, and aborting it to "block" the upgrade leaves the database in a state
  that is far harder to reason about than simply not bumping a number in `meta`. A single version
  for everything was also rejected: the two halves have opposite policies, so one number would force
  the safe one to follow the disposable one.
- **Consequence:** a logical bump needs no structural bump and vice versa. `migrateOperation` only
  walks forward, so a queue written by a newer build blocks an older one instead of being
  reinterpreted with fields it does not know.

## 2026-09-03 · The mirror stores the feed row verbatim, with index keys alongside it (O-F1)

- **Decision:** every mirror record is `{ id, row, updatedAt, …index keys }`, where `row` is exactly
  what `GET /sync/changes` sent. Booleans and nulls are **not valid IndexedDB keys**, so flags are
  stored as `0`/`1` (`archived`, `deleted`) and anything the index must skip is _omitted_:
  `liveDate` is absent on tombstones, `pendingReview` is present only on live rows that need review,
  and null foreign keys are left out rather than stored as null.
- **Alternatives:** spreading the index keys flat onto the row. Rejected: `lib/local/derive` (O-F3)
  is verified against `auditoria/offline-fixtures/`, and it has to receive the server's shape
  untouched for that comparison to mean anything.
- **Consequence:** reads unwrap `record.row`. The compound `dateCursor` index is `["liveDate", "id"]`
  — IndexedDB skips a record when any part of a compound key path is missing, which is what keeps
  the transaction list cursor from ever walking a tombstone, and the `id` half is what breaks ties
  between two transactions on the same date.

## 2026-09-03 · `idb` as a direct dependency (O-F1)

- **Decision:** `idb@8.0.3` (exact), as recommended by the plan §6. It was already in the tree as a
  transitive dependency of `serwist`, so it dedupes and costs ~1.2 kB gz.
- **Alternatives:** a hand-written promise wrapper (~150 lines). Rejected: it is code we would own
  and test for no gain, and `idb` gives a typed schema (`DBSchema`) plus the transaction handling
  that O-F4's atomic mirror+outbox write depends on.
- **Consequence:** `fake-indexeddb` joins as a devDependency, wired in `vitest.setup.ts`: jsdom has
  no IndexedDB, and the migration tests this item requires have to run inside `npm run ci`.

## 2026-09-03 · Purging is never automatic, and the outbox outlives the session (O-F1)

- **Decision:** `lib/query/purge.ts` changes contract. `purgePersistedCaches()` runs on an explicit
  logout and nowhere else, and never matches the `lf-vault-` prefix. The vault has its own
  `purgeVault(userId, { discardPendingWork })`: the mirror is cleared every time, because it is
  disposable and the next user on the device must not see it; unsent operations are kept unless the
  caller says otherwise, and the outcome reports how many were kept or discarded.
- **Alternatives:** refusing to purge anything while the queue is non-empty. Rejected: on a shared
  device that would leave one user's data readable by the next one.
- **Consequence:** an expired session touches nothing (D-7, invariant 7) — the app keeps reading the
  mirror and queueing writes. `SessionProvider` passes the safe default and warns when it keeps a
  queue; **the confirmation dialog that would pass `discardPendingWork: true` belongs to O-F5a/O-F6
  and does not exist yet**, so today unsent work always survives a logout.

## 2026-09-03 · The mirror only answers when the network is gone, and the seam is one constant (O-F2a)

- **Decision:** `features/*/api.ts` reads through `lib/local/repository`, whose `read()` calls the
  server whenever the app has network and the mirror only when it does not. `READ_SOURCE` in
  `repository/read.ts` is the single constant O-F2b flips to put the mirror in front always.
- **Alternatives:** promoting the mirror to the primary path in this same item. Rejected by plan §6:
  the two-step delivery is the safety mechanism of the whole offline stage, and the promotion is
  conditioned on the 113+ Playwright specs and every screen test passing with the mirror in front.
  Falling back on a `NetworkError` from the server instead of on the connectivity phase was also
  rejected: it would serve stale rows during a real outage while the UI still claimed to be online.
- **Consequence:** the online path is unchanged, so this item cannot break a screen that has network.
  The mirror-backed code only runs offline, which is exactly the code whose failures are discovered
  late — hence the tests that read the same data both ways and compare.

## 2026-09-03 · A mirror that cannot answer says so, and the read falls through to the server (O-F2a)

- **Decision:** a mirror reader returns `undefined` for "I cannot answer this", and `read()` then
  asks the server. That covers an id the mirror never saw and a vault whose first snapshot never
  finished (`meta.syncedAt` is written only by the page that drains the feed).
- **Alternatives:** throwing a locally built `ApiError(404)` or `NetworkError`. Rejected: a
  fabricated `requestId` is a lie in the one field support uses to trace a request, and a 404 for an
  id we simply do not have locally is not true. Returning an empty list was rejected for the same
  reason — a fresh device would render "no accounts yet" instead of an offline error.
- **Consequence:** offline, the fall-through hits the network and fails with the real error the app
  already knows how to present. Online, it is a normal request.

## 2026-09-03 · Mirror-backed query domains fetch while offline (O-F2a)

- **Decision:** `createQueryClient` gives `QUERY_DOMAINS.accounts` and `.categories`
  `networkMode: "offlineFirst"` through `setQueryDefaults`. `MIRROR_BACKED_DOMAINS` in
  `lib/query/domains.ts` is the list; O-F2b adds each domain as it starts reading locally.
- **Alternatives:** changing the global default. Rejected: the transactions screen tells "offline
  with nothing cached" apart by `fetchStatus === "paused"`, and that domain still reads from the
  server. Per-hook options were rejected too — the item must not touch the hooks.
- **Consequence:** without this the whole fallback would be dead code: React Query pauses a query
  while `onlineManager` says offline, and a paused query never reaches its `queryFn`.

## 2026-09-03 · The pull is scheduled by events, never by a timer (O-F2a)

- **Decision:** `startMirror` pulls when the app opens, when it regains focus and the copy is older
  than `PULL_STALE_MS` (5 min), and when the network comes back. `AppFrame` starts it for the
  signed-in user, which is also where `requestPersistentStorage()` is finally called.
- **Alternatives:** a background interval. Rejected by plan §4.2: a 30-second poll is 2 880 requests
  a day per device even when nothing changes — worse than the traffic local-first exists to remove.
- **Consequence:** freshness is bounded by user activity, which is the intended trade. Pulling right
  after each push arrives with the outbox (O-F4).

## 2026-09-03 · The transaction cursor is resolved locally as a keyset, not as an offset (O-F2a)

- **Decision:** `repository/transactions.ts` walks the `dateCursor` index (`["liveDate", "id"]`)
  backwards and treats the cursor the way the API does: the id of the last row served, whose own date
  is read back from the row it names to bracket the next page at `(date, id) <` that pivot.
- **Alternatives:** remembering how many rows were already served and skipping that many. Rejected:
  a pull between two pages inserts rows above the one the reader is on, and an offset then silently
  skips exactly as many rows as arrived — the bug infinite scroll is famous for. Materialising the
  filtered set once and finding the cursor's position in it was rejected for a subtler version of the
  same thing: a row edited out of the filter between two pages would no longer be in the list, and
  the page would restart. The server does not have that problem because it only ever reads the
  pivot's date, so the mirror does the same.
- **Consequence:** the local list survives a pull mid-scroll, and a tombstone can never be served:
  a deleted row has no `liveDate`, and IndexedDB skips a record when part of a compound key path is
  missing. It still works as a pivot, which is what keeps deleting the last row of a page from
  restarting the list.

## 2026-09-03 · Filters the index does not cover are applied while walking, not given an index (O-F2a)

- **Decision:** only the period brackets the index walk. Type, account, category, "uncategorized",
  tag, pending and quick-only are evaluated per row as the walk goes, and a query carrying any
  parameter the mirror does not implement is declined so the read goes to the server.
- **Alternatives:** an index per filter, or a composite index per combination. Rejected: the screen
  offers eight filters that combine freely, IndexedDB picks one index per query anyway, and every
  index that only half-answers a combination is a way for the local list to disagree with the API.
  Ignoring an unknown parameter was rejected outright — it answers a different question than the one
  asked, which is worse than not answering.
- **Consequence:** a filtered page costs a walk of the period's rows rather than a lookup. That is
  the same order of work the list already does to produce `total`, which the API counts over the
  whole filtered set on every page.

## 2026-09-03 · The list's own `summary` is summed locally; `/stats/spending` is not (O-F2a)

- **Decision:** `includeSummary=true` is answered from the mirror, adding the amounts as integer
  minor units (`Math.round(amount * 100)`, summed, divided at the end) exactly as the server stores
  and `$sum`s them. `fetchDailyStats` stays a server call.
- **Alternatives:** declining the summary and letting the pending tray fall through to the server.
  Rejected: it is the only field that read needs beyond the count, so the whole tray would stop
  working offline. Summing in floats was rejected by the fixtures' own example: `0.10 + 0.20` is not
  `0.30` in binary floating point.
- **Consequence:** the pending tray works offline. This is a plain sum over the same filtered set,
  not a derivation — day buckets, balances and `spent` need a time zone and a period and belong to
  `lib/local/derive` (O-F3), which is checked against `auditoria/offline-fixtures/`. When O-F3 lands,
  the pending summary moves there with the rest and gets the same fixture check.

## 2026-09-03 · Budgets decline offline instead of answering the view without `spent` (O-F2a)

- **Decision:** the mirror declines the budget list and the budget detail while there is no network,
  so both reads go to the server and fail honestly. `QUERY_DOMAINS.budgets` therefore stays out of
  `MIRROR_BACKED_DOMAINS`: unpausing a domain that cannot answer only turns a paused skeleton into a
  failed request. The seam is in place (`lib/local/repository/budgets.ts`) for O-F3 to fill.
- **Alternatives:** serving the view with `spent` derived locally — forbidden here, that is O-F3 and
  it is checked against `auditoria/offline-fixtures/`. Serving the half of the view that is not
  money — rejected because no budget surface can paint without the figure: `BudgetCard`,
  `GlobalBudgetCard`, `BudgetHero`, Home's `BudgetsSection` and `HeroCard`, the ordering in
  `BudgetsView` and `topBudgets`, `budgetProgress` and `budgetStatus` all read `budget.spent`, and
  `Budget` declares it required. Making it optional means changing five components and their tests,
  which this item excludes, to ship a degraded screen that O-F3 would revert two items later.
  Answering `spent: 0` was never on the table: invariant 2 forbids showing a figure nobody computed.
  Confirmed with the owner before implementing.
- **Consequence:** Budgets is exactly as offline-capable as it was — no better, no worse — until
  O-F3. Verified against the running backend that the stored shape is what forces this: of the view's
  fields, `archivedCategoryIds`, `periodKey`, `periodFrom`, `periodTo`, `baseAmount`, `spent`,
  `hasOverride` and `expired` are absent from `SyncBudget`, and over the ten seeded budgets
  everything but `spent` and the recurring period window derives from the stored row plus the
  categories mirror with zero mismatches. Only `spent` needs the transactions, and one seeded budget
  carries a non-zero one.

## 2026-09-03 · Home and stats keep their server reads and stay paused offline (O-F2a)

- **Decision:** Home's accounts, categories and pending tray now read through the repository and are
  answered by the mirror; its month spending and its budgets stay server calls. `features/stats`
  is not routed at all — it is `/stats/spending` and nothing else. Neither `QUERY_DOMAINS.home` nor
  `QUERY_DOMAINS.stats` joins `MIRROR_BACKED_DOMAINS`.
- **Alternatives:** unpausing `home` so the three local reads answer offline. Rejected after reading
  `HomeView`: it renders the error card when any of spending/accounts/budgets/income errors and
  returns the skeleton while `!data.spending.data`, so unpausing would replace today's offline
  skeleton with an error card and still show no data. Splitting the home keys into per-domain
  prefixes was rejected for the reason `domains.ts` exists: two files would then own the key shape.
- **Consequence:** nothing changes on screen yet; O-F3 adds the derived spending and the budget view
  and flips both domains at once. The plumbing is already verified: against the running backend,
  `/accounts?limit=100`, `/categories?includeArchived=true&limit=100` and the pending tray with
  `includeSummary` are byte-identical to what the mirror answers, envelope included.

## 2026-09-04 · Money derivations are pure functions with the fixtures vendored (O-F3 part 1)

- **Decision:** `lib/local/derive` takes arrays and returns figures, with no IndexedDB inside, so the
  very rows the backend verified against a real mongod are the rows the test feeds it. Balances and
  the pending summary land first; `spent` and the day buckets are part 2. The parity fixtures are
  copied verbatim into `lib/local/derive/fixtures/` and committed.
- **Alternatives:** reading `auditoria/offline-fixtures/` from the test. Rejected because that folder
  is in no repository and CI checks out only this one, so the parity test would never run where it
  matters. A test that skips when the folder is missing would have been green in CI while proving
  nothing. The vendored copy is guarded instead: on a machine that has the source folder, the test
  compares the two byte for byte and fails on drift; in CI it skips with that reason in its name.
- **Consequence:** `repository/transactions.ts` no longer does arithmetic — `includeSummary` calls
  `sumAmounts`, the same adder every figure uses. Nothing paints a derived balance yet, and nothing
  may until the projection is marked (invariant 2). Refreshing the fixtures now means copying them
  into this repo as well; asked of the generator in `BACKEND-DESDE-FRONT.md`.

## 2026-09-04 · The pending tray has one path, and a derived balance is an oracle, not the screen's recipe (O-F3 review)

- **Decision:** `derivePendingSummary` is removed. The repository already answers the quick-add tray
  (`pendingDetails=true&includeSummary=true`) and Home and Transactions read it there; the parity
  test now feeds the fixture rows into a test vault and checks that path against `expected.pending`.
  `deriveBalances` stays as the parity oracle for the balance rule, but what Accounts will paint once
  the outbox exists is the server's `balance` from the mirror plus the effect of the unsent
  operations, and O-F4 has to prove the two agree whenever the outbox is empty.
- **Alternatives:** keeping both derivations "because the plan listed the pending summary under
  `derive`". Rejected: two paths for one figure inside one repo is the drift the fixtures exist to
  prevent, and the second one was only ever executed by its own test. Deriving the shown balance from
  `openingBalance` plus the whole history. Rejected: it walks every transaction on the main thread for
  a figure the feed already carries, and the plan (§6) describes the mirror-plus-outbox projection.
- **Consequence:** the fixtures declare `pending.transactionIds` a set (the API's tray order is
  `date DESC`, which the old derivation did not follow either). Part 2 derives `spent` and the buckets
  over the rows the `dateCursor` index selects for the window, never over `getAll`.

## 2026-09-04 · The parity fixtures are vendored from the backend repo, not from a folder outside git (O-F3 review)

- **Decision:** `lib/local/derive/fixtures/` is refreshed with `npm run fixtures:sync` from the
  backend's committed `fixtures/offline/`, and `parity.test.ts` guards against that copy. The old
  `auditoria/offline-fixtures/` is no longer read by anyone.
- **Alternatives:** the previous arrangement (see the 2026-09-04 O-F3 part 1 entry above), where the
  source of the copy was a folder in no repository. Rejected once the backend committed the files:
  the contract can now be worked on from any machine, and the backend's CI fails when its generator
  and its files disagree, so every link of generator → backend files → this copy has a guard.
- **Consequence:** the chain is only as good as the sync step. Refreshing the fixtures is one command
  and the test says which file drifted.

## 2026-09-04 · Derive states the rule, the repository chooses the rows (O-F3 part 2)

- **Decision:** `deriveSpending` and `deriveBudgetView` re-apply their own window and type filters
  instead of trusting the caller to have pre-filtered, and `repository/window.ts` narrows the rows
  with the `dateCursor` index before handing them over. The two overlap on purpose: the pure
  function is the single written statement of the aggregation rule, checked against the fixtures the
  backend validated on a real mongod, and the index is how the device avoids walking rows it already
  knows are outside the window (D-18).
- **Alternatives:** letting the repository be the only filter and making `derive` a plain grouper.
  Rejected: the parity test would then have to pre-filter the fixture rows itself, which is a second
  implementation of the very rule the fixture exists to pin down, in the test rather than in the
  code. The other way round — no index, `getAll` and filter in the function — is what D-18 forbids.
- **Consequence:** a window is expressed twice, as an `IDBKeyRange` and as a comparison, and the two
  have to agree. `liveRowsInWindow` normalises each bound to the feed's UTC stamp before using it as
  a key, because the index compares the stamps as strings: a bound written with an offset
  (`2025-12-01T00:00:00-05:00`) sorts below every row of its own last day and would drop them
  silently. The comparison inside `derive` uses `Date.parse` and never had that problem.

## 2026-09-04 · The six `/stats/spending` call sites share one seam (O-F3 part 2)

- **Decision:** `lib/local/repository/stats.ts` exposes one `readSpending`, and all six call sites
  use it: `home.fetchSpending`, `budgets.fetchSpendingTotal`, `stats.fetchStats`,
  `transactions.fetchDailyStats`, `categories.fetchCategoryUsage`, `categories.fetchCategoryCounts`.
  It stamps the defaults `StatsController` stamps — `groupBy` `category`, `type` **EXPENSE** — which
  is not the service's "everything but ADJUSTMENT": that query exists only below HTTP, so only a
  fixture can ask for it and only `deriveSpending` implements it.
- **Alternatives:** routing the three the plan named and leaving the three inside `categories` and
  `transactions`. Rejected: those three live in domains that were already in
  `MIRROR_BACKED_DOMAINS`, so they were failing quietly offline, and splitting the derivation across
  six call sites is how the same figure starts disagreeing with itself.
- **Consequence:** `budgets`, `home` and `stats` enter `MIRROR_BACKED_DOMAINS` together, and every
  domain is now in it. `features/budgets/api.ts` lost `fetchBudgetsPage`, a dead export nobody
  imported (F-09): the design backlog plans no screen that reads a single batch of budgets, and it
  was the one budget read that never went through the repository.

## 2026-09-04 · Writes queue through `lib/local/outbox`, and the projection answers the screen (O-F4 part 1)

- **Decision:** every entity write moves out of `features/*/api.ts` into `lib/local/outbox`, the
  mirror image of `lib/local/repository`. `queueWrite` writes the projected row and its operation in
  **one** IndexedDB transaction and aborts explicitly on any failure; `write()` answers the caller
  from that projection and then sends once, inline. Only the transport policy is deferred: single
  flight, backoff, coalescing and retries are O-F4 part 2.
- **Alternatives:** keeping the mirror as the server's copy and replaying the queue at read time.
  Rejected: the plan says the row is written optimistically, and replaying a queue on every list
  read is the cost the mirror exists to avoid. Writing the row and the operation in two transactions
  was never on the table — that is the phantom movement the item exists to prevent, and it is why
  both stores share one database (O-F1).
- **Consequence:** each money operation carries what it replaced and what it left, because after the
  optimistic write the mirror no longer holds the row the server has. Those deltas telescope, so a
  second operation on the same row records what the first one left and their sum is still the
  distance between the server's row and the screen. `projectBalances` is the mirror's `balance` plus
  that sum, and it borrows the movement rule from `deriveBalances` instead of restating it: with an
  empty queue the two agree by construction, and with a queue the projection equals the oracle over
  the optimistic rows. Four kinds of server answer are told apart by hand: retryable (network, 5xx,
  429, 401) keeps the operation, `409 STALE_UPDATE` marks it `conflict`, a 404 on a removal **is**
  the desired state, and any other 4xx undoes the mirror write and rethrows.

## 2026-09-04 · The idempotency key becomes the row's id (O-F4 part 1)

- **Decision:** creates carry a client-minted UUID v7 and stop sending `Idempotency-Key`, which O-B1
  makes redundant. Where a form already had an `IdempotencyKeyring` — the transaction form, quick
  capture, adjust balance — the key it produces **is** the id, so a retried submit still names one
  row. `PATCH /transactions/batch` keeps its header: it has no single id to carry.
- **Alternatives:** dropping the keyrings and minting an id per call. Rejected: it would duplicate a
  row on a double submit, which is exactly what the keyring was there to prevent.
- **Consequence:** `POST /transactions/batch` and `POST /categories/restore-defaults` are the two
  writes still going straight to the server (F-20). Verified against the real API: the server keeps
  a v7 id (zod 4's `.uuid()` accepts it, zod 3's would not), replays the same id with 200, and
  answers `409 STALE_UPDATE` to a stale `If-Match` and 404 to a second delete.

## 2026-09-04 · What the marking of projected figures covers now, and what waits for O-F5a (F-16)

- **Decision:** `components/ui/Projected` puts the amber `cloud-off` mark of DESIGN §8.12 next to a
  figure whose family the queue can move, driven by `outboxStatusStore`. It covers the balances
  (list, detail, Home, the total and the card debt), `spent` with its progress bars in every budget
  surface, Home's month figure and day bars, Statistics' headline total and its day bars, and
  Movements' period summary. The `ConnectionBanner` counts what is waiting and turns red on a
  conflict.
- **Alternatives:** marking every row of the Statistics breakdown and every category usage count.
  Rejected: twenty cloud icons in one list is noise, and those rows sit under a headline that is
  already marked on the same screen.
- **Consequence:** what stays open in F-16 is O-F5a's: the per-row "Pending sync" badge on a movement
  saved locally, and the red banner's "Review" action with the conflict sheet behind it.

## 2026-09-04 · One description of each request, shared by the write and the replay (O-F4 part 2)

- **Decision:** `lib/local/outbox/routes.ts` holds one entry per route — how to build the request and
  what to write back on success — and both callers use it: the write that queues the operation and
  the engine that replays it later. The entity modules keep only their projection, their guard and
  what the screen reads back.
- **Alternatives:** leaving `send`/`confirm` in each entity module and giving the engine its own
  replay table. Rejected: two descriptions of the same request drift, and the one the engine uses is
  the one nobody exercises in a screen test.
- **Consequence:** an operation replayed after a reload rebuilds its request from `payload.body` and
  `payload.query`, which is why the envelope stores the body verbatim instead of re-deriving it from
  the mirror. A route missing from the table is a typecheck error, not a runtime one.

## 2026-09-04 · What the queue may fold, and what it may not (O-F4 part 2)

- **Decision:** `coalesce.ts` folds only where the second operation states the whole of what the
  first one did: `update` + `update`, `update` folded into an unsent `create`, two `setOverride` for
  the **same** budget period, and `create` + `delete` of a movement, which cancels both and drops the
  row from the mirror. Nothing folds across an operation the server has already been asked about
  (dispatched, `sending`, or in conflict), and the `effect.before` that survives is the **first**
  one's.
- **Alternatives:** folding `create` + `archive` to nothing, the way `create` + `delete` folds.
  Rejected: archiving is a state, not a removal — an archived account is still the user's row and can
  be restored, so dropping it would lose data the user still has on screen. Also rejected: folding an
  `update` into a later `archive`, which would silently throw away edits a restore would then show
  stale.
- **Consequence:** ten edits offline leave as one request and a created-then-deleted movement leaves
  as none, verified against the real API. `effect.before` is what keeps the balance projection right:
  the mirror stopped holding the server's row at the first write, so keeping the second `before`
  would count that first move twice.

## 2026-09-04 · The batch of movements is queued expanded, not sent as a batch (F-20)

- **Decision:** `batchUpdateTransactions` queues one `transaction:update` per row and drains them in
  a single pass, instead of calling `PATCH /transactions/batch`. The screen still reads
  `{ updated, failed }`; the rows that fail are the ones the server refused.
- **Alternatives:** an envelope action `batch`. Rejected: the envelope carries one `entityId` and one
  `If-Match`, so a batch operation is one the engine cannot retry, guard or conflict-resolve per row.
- **Consequence:** online this is N requests where it used to be one, which is the price of a
  per-row guard and of the review tray working with no network at all. The `Idempotency-Key` the
  screen minted is gone: each row is addressed by its own id.

## 2026-09-04 · A rejection nobody is left to hear stays in the queue (O-F4 part 2)

- **Decision:** the rollback a write registers lives in memory. When the server refuses an operation
  for good and that rollback is still there, the engine undoes the mirror write and the error reaches
  the form. When it is not — the operation outlived the tab that made it — the operation stays queued
  as `failed` instead of disappearing.
- **Alternatives:** dropping it and letting the next pull overwrite the row. Rejected: the server
  never received the write, so no pull would ever correct the mirror, and the user would keep a row
  that silently never syncs.
- **Consequence:** a `failed` operation holds its own row and its dependents, and keeps the amber
  mark on. The tray that lets the user see and resolve it is O-F5a.

## 2026-09-04 · A chain of guarded operations on one row is rebased as it lands (R-2 review)

- **Decision:** when an operation lands and the server answers a row, the engine rewrites the
  `baseUpdatedAt` of the operations still queued on that row that share the landed one's guard, to
  the `updatedAt` the server answered with, inside the transaction that settles it. A queued guard
  that differs was moved by a pull and is left alone. The archive routes keep the row when the
  answer carries one, so a restore queued behind an archive is rebased the day the backend answers
  it (F-22).
- **Alternatives:** reading the guard from the mirror at send time. Rejected: the mirror's
  `updatedAt` also moves when a pull brings another device's edit, and sending that stamp would
  silently overwrite it — the frozen guard is what makes the 409 honest. Dropping the guard on the
  second operation of a chain. Rejected: it is the window in which another device can write.
- **Consequence:** an edit followed by a delete, or an archive followed by a restore, no longer ends
  in a `409 STALE_UPDATE` the user never caused — verified against the real API for the edit-then-
  delete case; the archive case still waits for F-22. Without the rebase every unfolded chain on one
  row conflicted, because the client never writes `updatedAt` (invariant 2) and both operations read
  the same stamp when they were queued.

## 2026-09-04 · A fold never crosses the create it depends on, and a half-undoable fold stays (R-2 review)

- **Decision:** `coalesce` does not fold an edit into an earlier operation when the edit names, in
  `dependsOn`, a row whose create sits between the two; the edit starts a run of its own. The engine
  also holds any operation whose `dependsOn` names a create still ahead in the pass. And a refused
  fold is undone only when every operation in it still has its rollback; otherwise the whole run is
  kept as `failed`.
- **Alternatives:** trusting `seq` alone for dependency order. Rejected: a fold moves the second
  operation to the first one's place, and against the real API that put a movement's move to a new
  account ahead of the account's `POST` — a `404` the engine took for a definitive refusal, undoing
  both edits. Undoing the rollbacks a fold still has. Rejected: it leaves the mirror at the first
  edit with no operation behind it, the phantom the `failed` state exists to prevent.
- **Consequence:** `dependsOn` is an order as well as a hold. Re-minting an account now also rewrites
  the `effect` rows of the movements queued against it, so the projected balance of the new id keeps
  them.

## 2026-09-04 · A text-only conflict merges itself; money and structure ask (O-F5a part 1)

- **Decision:** the field classification of the offline plan (§6 O-F5a) lives in
  `lib/local/outbox/conflict.ts` and looks at the **operation**, not at the diff: an `update` whose
  body carries only `description`, `note`, `tags`, `name`, `color` or `icon` is text, and on a
  `409 STALE_UPDATE` the engine rewrites its guard to the stamp the server answered with and puts it
  back in line without a word to the user. Anything else — money, a category, a date, a create, a
  removal — becomes `conflict` and waits for the sheet. The merge gives up after
  `AUTO_MERGE_ATTEMPTS` (5) and never retries against a stamp that did not move.
- **Why it is safe:** every `PUT` of the API takes each field as optional, so a body of text fields
  is a partial update: retrying it over the new stamp keeps whatever the other device wrote in the
  other fields. Verified against the real backend — an offline `description` and another device's
  `amount` both survive.
- **Alternatives:** classifying the diff (a text field that happens to match would stop being a
  conflict, which is right, but a money field that matches would silently merge too — and the
  server's row is exactly what the user has to see before that happens); putting the list in the
  backend (two copies in two repos, and `POST /sync` would have to grow a vocabulary it does not
  need).
- **Consequence:** the common two-device case — renaming a category, fixing a description — never
  reaches the user, and the sheet only ever opens on a decision that is genuinely one.

## 2026-09-04 · The 409's `current` travels in the envelope, not in the mirror (O-F5a part 1)

- **Decision:** `ApiError` carries `current` (the row the backend puts in a `409 STALE_UPDATE`, O-B2)
  and the engine stores it on the operation as `serverRow`. The sheet reads the two versions from
  the envelope alone: `payload.body` is what this device wanted, `serverRow` is what the server had.
- **Alternatives:** re-reading the row after a pull. Rejected: the mirror holds **this device's**
  projection of that row, so it can only answer for one of the two sides, and a pull that had not
  run yet would leave the sheet with nothing to show. It also costs a request per conflict.
- **Consequence:** `current` is not in the OpenAPI schema, so the client reads it as an untyped field
  of the error body. If the backend ever stops sending it the sheet still opens, warns that the
  server's version is unknown, and offers the same two ways out.

## 2026-09-04 · Discarding a create takes its dependents with it (O-F5a part 1)

- **Decision:** `discardOperation` settles the operation without sending it and puts `serverRow`
  back in the mirror. When what is discarded is a **create**, everything that names that row in
  `dependsOn` goes too, transitively, and the row leaves the mirror.
- **Why:** the server never saw that id, so no pull would ever correct the mirror, and an operation
  addressing it would ask about a row nobody has — it would sit held forever, keeping the amber on.
- **Consequence:** discarding one refused create can remove several queued operations. The result
  says how many, and the tray of part 2 is where that number is shown before the user confirms.

## 2026-09-04 · Resolving one operation does not rebase the others on its row (O-F5a part 1)

- **Decision:** neither discarding nor retrying moves the guard of the operations queued behind it on
  the same row. Each earns its own 409 and its own resolution.
- **Alternatives:** applying the user's choice to the whole chain. Rejected: D-22 rebases only what
  an answer from the server has just proved, and "keep my amount" is not "keep my category". The
  common case costs nothing anyway, because a text-only follow-up merges itself.
- **Consequence:** a chain of structural edits on one row can open the sheet more than once. That is
  the honest number of decisions, not a defect.

## 2026-09-04 · The pull reprojects what the queue has not sent (O-F5a part 2, D-23)

- **Decision:** `applyPage` writes the row the feed sent and then projects back on top of it, in
  `seq` order, the `payload.body` of every operation on that row still `pending` or `sending`. The
  table of rules is `lib/local/outbox/reproject.ts`, one entry per route. A row whose operations are
  `conflict` or `failed` shows the **server's** version: those will never be sent, and the user's
  version lives in the sheet, which is its only home.
- **Why:** without it the 60-second overlap of D-14, or any edit from the other device, reverts a
  change made with no network — and a movement deleted offline reappears alive.
- **Alternatives:** skipping any row with a queue (hides the new `balance` of an account and
  everything the other device touched); letting the server win (the resurrection above). Both were
  rejected by the owner on 2026-09-04, who delegated the choice.
- **Consequence:** `applyPage` needs `outbox` in its transaction scope, and every new route needs a
  reprojection rule or its offline write is lost on the next pull. A **create** deliberately has no
  rule: a create in the feed is one whose answer was lost, so the server's row is the newer of the
  two. `updatedAt` is never rewritten, so the guard the next write reads is still the server's stamp.

## 2026-09-04 · The tray has a route of its own, not a place in Settings (O-F5a part 2)

- **Decision:** "Needs your attention" lives at `/sync`, not under Ajustes › Sync status.
- **Why:** Sync status is O-F6's, and the red stripe needs somewhere to send the user today. A page
  of its own is also what the stripe, the sheet and (later) Sync status can all link to.
- **Consequence:** O-F6 links to `/sync` from Sync status instead of rebuilding the list. The route
  is not in the nav: it is reached from the stripe, and it says so when there is nothing to show.

## 2026-09-04 · The mirror keeps the server's row aside while a row has a queue (R-3, D-24)

- **Decision:** every mirror record carries `server?`, the row as the server last sent it, present
  only while the outbox holds operations on that row. One function, `reconcileRow`, restates
  `row = server + what the queue will still send` and is the only way a row changes when something
  new is known about it: a page of the feed, a write's answer, a 409's `current`, a definitive
  refusal, a discard, a retry. The projected balance uses only operations that will still be sent,
  and each queued movement's money `effect` is restated from the server's row on every pull.
- **Why:** D-23 promised that a row whose operation is in `conflict` or `failed` shows the server's
  version, and only the pull kept that promise. Reproduced against the real API in R-3: after a
  `409`, what the row showed depended on whether the pull or the drain ran first on coming back
  online (two runs of the same sequence gave both answers), the balance still carried the effect of
  an operation that would never be sent, and discarding a `failed` write left the refused projection
  in the mirror for good — the server's stamp never moved, so no pull ever brought the row back.
- **Alternatives:** fetching the row when a `failed` write is discarded (needs network to resolve
  something the tray offers to resolve without it, and fixes one of four moments); reprojecting from
  the operation's own `serverRow` (a 409 has one, a 400 does not); storing the pre-projection row on
  each operation (stale the moment a pull brings a newer server row).
- **Consequence:** `MIRROR_VERSION` goes to 2 — the mirror is re-pulled, the outbox untouched.
  `Route.confirm` receives the operation, so a removal confirmed without a row (F-22) can move the
  baseline the way it asked. A resolution acts only on operations still stuck. `pendingDetails`
  joins the text fields: the PUT behind every quick capture no longer asks the user when the other
  device touched the row.

## 2026-09-04 · The offline shell caches a route by its path, not by its URL (O-F6, F-06)

- **Decision:** the worker keeps two runtime caches of its own for the `(app)` routes, `app-shell`
  (documents) and `app-shell-rsc` (RSC payloads), both keyed on origin + pathname and matched with
  `ignoreVary`. When the app has a session it posts the list of routes and the worker fetches the
  ones it does not already hold. A navigation that neither the network nor the cache can answer
  falls back to `public/offline.html` (or `.es.html`), precached with a revision of its own.
- **Why:** `defaultCache` keys on the whole URL, so `/transactions?type=EXPENSE&_rsc=…` never
  matched the entry stored for `/transactions` and changing a filter with no network showed the
  browser's error page (F-06, reproduced against the previous worker). None of these pages reads
  `searchParams` on the server, so one entry per route is the right key. Warming is what makes a
  route the user never opened answer at all: without it the first visit offline has nothing.
- **Alternatives:** precaching at install (the worker installs before there is a session, so every
  route would be the login redirect); one cached document for the whole group (it would show Home at
  `/budgets`); leaving the RSC hop to fail (Next falls back to a full load, which the document cache
  can answer, but the hop is a second of nothing first).
- **Consequence:** a new worker deletes both caches on `activate`, because its build ships new
  chunks and the documents the old one warmed point at files that are gone. The fallback documents
  are static, so their text lives in `public/` and not in `messages/` — one file per locale.

## 2026-09-04 · A read waits for the vault the frame is about to open (O-F6, F-31)

- **Decision:** `repository/read.ts` holds a gate that `AppFrame` raises while it renders and that
  `startMirror` lowers with the handle, or with null when no vault opens. `read()` waits for it
  before choosing a source.
- **Why:** the screens render, and query, before the frame's effects run: `read()` saw no vault and
  went to the server with a full mirror sitting there. Measured with `READ_SOURCE="mirror"`: opening
  Home cost 12 reads with the gate missing and **0** with it.
- **Alternatives:** raising the gate in the effect that opens the vault (child effects run first, so
  it is already too late); a deadline (a timer that hides the ordering instead of fixing it).
- **Consequence:** the gate is raised in a render, which is why it is one-shot and idempotent. When
  the session settles without a user, the frame lowers it: nothing is going to open a vault, and a
  read that waited forever would spin a screen instead of failing.

## 2026-09-05 · The session marker stops being authority, and outlives the session (O-F6, §2.6)

- **Decision:** `__Host-session` changes meaning. It carries `<userId>.<issuedAt>`, lasts 400 days
  instead of 30, and is readable by scripts. It says "this device holds a vault for this user" and
  nothing else; the API is what says whether a session is valid. `proxy.ts` uses it to let `(app)`
  through, and `AppFrame` uses it to know whose vault to open when the session cannot be resolved.
- **Why:** the refresh token lasts 30 days and the offline vault is meant to last indefinitely. At
  day 31 the proxy sent the user to `/login` and the app they could still have used offline became
  unreachable — with their unsent queue inside it.
- **Alternatives:** lengthening the refresh token (D-15 keeps it at 30 days, and a long-lived
  credential is a different risk); passing the id down from the server layout (the app-shell cache
  of O-F6 part 1 would serve a document with a stale id after a user change); a second cookie for
  liveness (a cookie the proxy cannot even see, since the refresh one is scoped to `/api/auth`).
- **Consequence:** three things follow. A 400-day marker would bounce a dead session off `/login`
  forever, so `?reauth=1` is the declared way past `isGuestOnlyPath`. The id is no longer secret to
  scripts — it is an opaque id, never a credential, and an XSS that could read it already has the
  API. And the engine compares the marker against the open vault before sending, so a second user
  signing in on the device cannot get the first one's queue filed under their session.

## 2026-09-05 · A dead refresh no longer clears site data (O-F6, invariant 7)

- **Decision:** `endSessionResponse` splits in two. An explicit logout clears the three cookies and
  asks for `Clear-Site-Data: "cache"`; a dead refresh token (`/api/auth/refresh` answering 401)
  clears only the access and refresh cookies and asks for nothing.
- **Why:** the old response sent `"cache", "storage"` on both paths. `"storage"` deletes IndexedDB,
  so the moment a refresh token expired the browser threw away the vault, the unsent outbox and the
  offline shell — the exact scenario local mode exists for, and a direct breach of invariant 7.
- **Alternatives:** keeping `"storage"` on logout only (it still decides for the user what F-34 is
  supposed to ask them); scoping the header (it has no per-store granularity).
- **Consequence:** what leaves on a logout is now decided in one place, `purgeVault`, which already
  knew how to drop the mirror and keep the queue. Losing `"storage"` on logout means non-vault
  origin storage is no longer wiped by the header; the mirror goes through `purgeVault` and the
  React Query caches through `purgePersistedCaches`, which is what actually held per-user data.

## 2026-09-05 · The mirror is the read path, and the server is what it falls back to (O-F2b)

- **Decision:** `READ_SOURCE` in `lib/local/repository/read.ts` is `"mirror"`. Every read of the six
  mirror-backed domains is answered from IndexedDB whenever a pull has drained at least once, with
  network or without it. The server answers a read only where the mirror says it cannot: no vault, no
  finished snapshot, an id it never saw, a query it cannot apply, or a derivation with no profile to
  take the zone from.
- **Why:** plan decision 12.2. One read path is one set of bugs, one set of tests, and a feature
  written once. A permanent fallback is code that only runs when the user has no network, so its
  failures are found late and without logs — and the screens stop paying a request for data they
  already hold (plan §4.2).
- **Alternatives:** keeping the fallback of O-F2a. Rejected as above. Reading the mirror first and
  reconciling against the server behind it: two answers per read, and the second one is exactly what
  the pull already brings.
- **Consequence:** setting the constant back to `"server"` is the whole way back, which is why it is
  one constant and not a spread of branches. `/stats/spending` and the listing endpoints are no
  longer on any screen's path — the backend keeps them: they are the oracle every parity test
  compares against, and other clients read them. A device's first load still goes to the server, so a
  new sign-in is not a blank app while the snapshot arrives.

## 2026-09-05 · A pull that brought news invalidates every mirror-backed domain (O-F2b, F-38)

- **Decision:** `pullChanges` answers whether any row it applied carried an `updatedAt` the mirror did
  not already hold; `startMirror` reports that through `onChanged`, and `AppFrame` invalidates all six
  mirror-backed domains at once.
- **Why:** with the mirror in front, the pull writes where React Query cannot see it, so a change made
  on another device landed in IndexedDB and the screen went on showing what it had read until a
  reload. It is what made `budgets.spec.ts:89` fail 6 of 6 with the mirror primary.
- **Alternatives:** mapping each entity to the domains that show it — rejected: the failure mode of a
  wrong map is a screen that lies in silence, and the map drifts the first time a screen joins one
  more domain. Publishing a snapshot the screens subscribe to — a second cache next to React Query's,
  for a re-read that already costs nothing. Invalidating on every pull, news or not — the feed
  overlaps 60 seconds on purpose (D-14), so that is a wave of refetches after every single push, and
  with `READ_SOURCE` back at `"server"` those would be requests.
- **Consequence:** an invalidation is a re-read of IndexedDB, not a request, so the granularity is
  affordable; the same code with `"server"` would cost one refetch per active query, which is the
  reason the news test exists and is asserted in `mirror.test.ts`.

## 2026-09-05 · The transaction list counts with the index when nothing is asked of each row (O-F2b, F-15)

- **Decision:** `queryMirror` takes `total` from `index.count(range)` and stops walking once the page
  is full, but only when the query carries no per-row filter and no summary. A filtered query still
  walks the whole set, as before.
- **Why:** the endpoint counts the whole filtered set on every page and so must the mirror, but the
  walk deserialises every record to do it. Measured in Chromium over 10 000 live rows: 141 ms per page
  walking, 31 ms counting plus 1,4 ms walking — and that cost was paid again on every page of an
  infinite scroll, on the main thread.
- **Alternatives:** caching `total` per filter across pages (the cheapest, and the one the ficha
  proposed) — it needs invalidation of its own and would answer a stale count after a pull; an index
  per filter combination — that is how a local list starts disagreeing with the API.
- **Consequence:** both requests are issued before the first `await`, so they share one read
  transaction and cannot see two states. A filtered list is still O(n) per page; nothing measured says
  it needs more than this yet.

## 2026-09-05 · Writes run with no network instead of being paused (Puerta O-A)

- **Decision:** mutations default to `networkMode: "offlineFirst"`, and `shouldRetryQuery` refuses a
  retry while the connectivity store says the app is offline.
- **Why:** the gate demo found that no write worked with no network. React Query pauses a mutation
  while `onlineManager` is offline, so the `mutationFn` — and with it `lib/local/outbox/write` and the
  whole queue of O-F4 — was never reached: the form spun for ever and nothing was saved, not even
  locally. With the mutation running, a second pause appeared behind it: `offlineFirst` fires the
  first fetch and pauses the retry, so the invalidation a write awaits on success never resolved when
  the read it re-ran was one the mirror cannot answer (a deleted row's detail, F-46).
- **Alternatives:** setting the mode per mutation — the same trap for the next feature, and §11's
  checklist cannot enforce a default; keeping the retry and having the invalidation not be awaited —
  it is the awaited invalidation that keeps a screen from painting a stale figure after a save.
- **Consequence:** a write that has no vault to queue into now fails visibly with no network instead
  of hanging, which is what §6 of `CLAUDE.md` asks for; a read that misses the mirror offline shows
  its error state after one attempt instead of never settling.

## 2026-09-05 · Every static route is in the shell, and a detail route is cached once, by template (R-3b, F-47, F-48)

- **Decision:** `SHELL_PATHS` lists every static route of `(app)` — eighteen, not nine — and
  `shell.test.ts` compares the list with the `page.tsx` files, so a screen added without an entry
  fails the build. The dynamic routes (`/<entity>/[id]` and `/[id]/edit`, seven) are cached **once
  per template**: `shellCacheKey` folds a UUID segment into `[id]`, the warm-up fetches each template
  with a placeholder id, and the seven pages render a client wrapper that reads the id from the URL
  (`useDetailRouteId`) instead of passing `params.id` down.
- **Why:** the R-3b probe found that with no network the app could not create an account, a category
  or a budget — not because the queue failed, but because their forms were not in the shell and
  answered `offline.html`; and that saving an account or a budget navigated to a detail route no
  cache entry had ever been made for. F-48 as written (a movement created offline cannot be opened)
  was the smallest face of it: **no detail route opened offline unless that exact row had been
  visited before with network.**
- **Alternatives:** opening details as a sheet over the list (a Next route still fetches its RSC
  payload, so it only works with the id in the query string — a URL change for four entities);
  rewriting `/<entity>/<uuid>` to a static route in `proxy.ts` (cleaner router state, but a rewrite
  per entity plus moved files for the same result); serving the list's document for a detail URL
  (the router would render the list).
- **Consequence:** the document and the RSC payload of a detail route carry no id, which is why the
  screens render nothing until the client has mounted (`useSyncExternalStore` with a false server
  snapshot): server HTML that named a row would hydrate against a different URL. `useParams()` must
  not be used on these routes — the router tree can name the row the cache entry was made for. A
  detail request always tries the network first, so with network nothing changes.

## 2026-09-05 · The mirror answers 404 for a deleted row itself (R-3b, F-46)

- **Decision:** `readTransaction` throws the API's 404 (`mirrorNotFound`) when the record is a
  tombstone, instead of returning `undefined` and letting `read()` ask the server.
- **Why:** it was the one data read that left the device with no network in the whole gate demo, and
  the root of the sheet that spun for ever on delete: the invalidation a write awaits re-read a
  detail the mirror refused to settle, and the retry paused. `shouldRetryQuery` refusing a retry
  offline (the demo's fix) closes the symptom; this closes the cause, and it is what makes awaiting an
  invalidation safe — no mirror-backed read goes to the server while offline.
- **Alternatives:** keeping "only the server can say 404" — true for an id the mirror never saw,
  which still goes to the server; not awaiting invalidations — a saved screen could paint a stale
  figure.
- **Consequence:** `MirrorReader` has two ways to decline: `undefined` means "ask the server", a
  thrown `ApiError` means "this is the answer". The detail of a row just deleted shows its not-found
  state for a frame before the screen leaves for the list, which is what the server path did too.

## 2026-09-05 · Signing out needs a connection (R-3b)

- **Decision:** «Sign out» in Settings and «Sign out all other sessions» are disabled while the
  connectivity store says offline, with a line saying why. `useOffline` is the shared hook, also used
  by F-20's restore-defaults.
- **Why:** with mutations on `offlineFirst` the logout request runs and fails offline, `onSettled`
  purges the device anyway, and the HttpOnly cookies — the session — stay: the probe ended on the
  browser's error page (`/login` is not a shell route), `GET /api/auth/me` answered 200 when the
  network came back and `/home` opened signed in. Before, the mutation paused and the button spun
  until the network returned; that was slow, this was a lie.
- **Alternatives:** `networkMode: "online"` for the two logout mutations (back to the infinite
  spinner); clearing the device and leaving the server session for later (a shared device stays
  signed in for whoever comes next).
- **Consequence:** sign-out is the one action in `(app)` besides restore-defaults that says it needs
  the network, in line with plan §13 (session flows are not offline features).

## 2026-09-05 · A new worker re-warms the shell it replaces, and local mode warms it too (R-3b)

- **Decision:** on `install` the new worker fetches every key of the current shell caches again into
  a staging cache (through the same `NetworkFirst` strategies, so the key rules hold), and on
  `activate` it swaps staging for live instead of only deleting. `AppFrame` asks for the warm-up
  whenever it has a vault to open (`localUserId`), not only when the session is `authenticated`.
- **Why:** deleting on `activate` left the shell empty until the next open with a live session. A
  worker activates when the last tab closes, so "deploy, open once online, close, open offline" showed
  `offline.html`; and in local mode (dead session) the warm-up never ran again, so one deploy ended
  offline use for good. Install is the one moment a new build is certain to have the network.
- **Alternatives:** keeping the old documents (they point at chunks the precache cleanup removes);
  versioned cache names (the worker has no build id to name them by).
- **Consequence:** a route the install cannot fetch is dropped and warmed again by the app on its
  next open; nothing stale survives an update. Not exercised end to end — Playwright cannot ship a
  second worker build in one run — so this rests on the worker's code and on the shell tests.

## 2026-09-05 · The worker serves documents from its cache, never RSC payloads (R-3b, F-51)

- **Decision:** the `app-shell-rsc` cache is gone. A client-side navigation's RSC request is
  network-only; with no network it fails, the router falls back to loading the document, and the
  document cache (keyed by route template) answers that.
- **Why:** the router reads the URL and the rewrite headers of the response it gets. A payload served
  from a cache keyed by path carries the URL it was stored under — without the query, and for a
  template entry with another row's id in `x-nextjs-rewritten-path` — so Next concluded the server had
  rewritten the request: on desktop it chased the rewrite and reloaded anyway (the toast after a save
  vanished), on mobile the month change in Budgets never changed the URL at all. Reproduced in
  isolation on `feabe7f` too: it predates this review.
- **Alternatives:** re-pointing the rewrite headers on the cached response (a new `Response` loses
  `url`, which the router also reads, and the fix would track Next's internals release by release);
  keying RSC entries by path plus query (soft navigations only for exact matches, the rest still
  reload — the same behaviour with more code).
- **Consequence:** with no network every navigation is a full document load from the cache: slower
  than a soft navigation, and a toast shown just before it does not survive. With network nothing
  changes. The gate demo asserts the outcome of a save on the destination screen, not on the toast.

## 2026-09-05 · The (app) screens render on the client only (R-3b, D-29)

- **Decision:** `AppFrame` renders the page's children only once the client owns the page
  (`useMounted`); the shell around them — navigation, banner, sheets — still comes from the server.
- **Why:** with the worker serving one cached document per route template (D-28), the HTML a page
  hydrates against may have been rendered for another URL: another query, another row. React keeps the
  server's attributes when they do not match the client's, so a filter chip or a segment stayed on the
  server's choice after an offline reload — Stats showed the first type and the first grouping as
  selected whatever the URL said — and every text that depends on the URL or the clock raised a
  hydration error (F-53). The screens are data-driven client work already; the server HTML they lost
  was a skeleton.
- **Alternatives:** gating each URL-dependent control by hand (the next one is forgotten); rendering
  documents per URL (that is the cache-by-id problem F-48 removed); `suppressHydrationWarning` (it
  hides the warning and keeps the wrong attribute).
- **Consequence:** the first paint of an `(app)` page shows the shell and an empty content area for
  one frame, then the screen with its own loading state. `useDetailRouteId` reuses the same hook.
  Screens outside `(app)` — the landing, login, legal pages — are untouched and still render on the
  server.

## 2026-09-05 · Server-side preferences say they need a connection (R-3b)

- **Decision:** language, currency, time zone, the profile form and deleting the account show
  «Changing this needs a connection» and keep their action disabled while the connectivity store says
  offline, the way restore-defaults (F-20) and sign-out already do.
- **Why:** offline, choosing a language did nothing and said nothing (the options were silently
  disabled because the session could not be resolved), and saving a time zone failed with «Something
  unexpected happened» — the mutation threw its own "No session" error before any request. Plan §13
  keeps these out of the offline scope; the app has to say so instead of failing oddly.
- **Alternatives:** queueing profile changes in the outbox (the profile is not an entity the queue
  projects, and a locale change also moves the route; a design of its own); switching the UI locale
  locally and saving later (two sources of truth for one preference).
- **Consequence:** one message key, `settings.needsConnection`, and the `useOffline` hook in the five
  places. Nothing changes with network.

## 2026-09-05 · Hover hints on the projected mark and the stats bar (R-3b)

- **Decision:** the cloud that marks a projected figure (`Projected`) and each colour of the Stats
  category bar (`StackBar`) show a hint on hover and focus with the existing `Tooltip`: the mark says
  «Includes changes not yet synced», the bar segment names its category.
- **Why:** the owner's manual test: the mark alone, without the badge's text, said nothing to a
  pointer, and the bar's colours could not be told apart from the list below without matching them by
  eye.
- **Alternatives:** `title` attributes (no styling, no keyboard); a legend under the bar (the list
  below is the legend; the hint answers the question where the eye is).
- **Consequence:** `Tooltip` accepts a `style`, because a stacked bar sizes its segments by
  percentage and the wrapper has to carry that width.

## 2026-09-06 · The queue leaves in one request, and the routes stay as the fallback (O-F5b)

- **Decision:** the engine sends the whole outbox to `POST /sync` as one batch (1–200 operations,
  body under a megabyte, cut in `batch.ts`) and spreads the six statuses of the answer over the queue
  transitions that already existed. If `POST /sync` answers `404` or `501` — a server older than this
  front — the queue keeps leaving by the ordinary per-operation routes for the rest of the session; a
  `400` or `413` on the envelope sends that one pass by the routes too, and keeps the batch.
- **Why:** N requests deduced each operation's fate from N error codes, and three of the six outcomes
  the contract now answers (`merged`, `duplicate`, `blocked`) have no HTTP code to deduce them from.
  The owner asked for the fallback (2026-09-06): front and backend deploy apart, and a `404` with no
  fallback strands every queued write on the device until the backend catches up. `routes.ts` cannot
  be deleted in any case — `sendDirect`, the write with no vault, still goes through it.
- **Alternatives:** batch only, no fallback (one transport, less code; a bad deploy order stalls
  every device's queue); keeping the routes for conflicts and the batch for the rest (two paths for
  the same operation, which is the duplication trap 7.8 warns about).
- **Consequence:** two transports and two suites. `syncTransport()` says which one is in use, for
  Ajustes › Sync status (O-F6) to report.

## 2026-09-06 · `seq` on the wire is the rank inside the batch (O-F5b)

- **Decision:** each operation travels with its position in the batch as `seq`, not with the device's
  counter. Locally, a resolution that has to be applied **before** the operation it unblocks is
  queued with a fractional `seq` between its target and whatever precedes it (F-58).
- **Why:** the server takes `seq` as `z.number().int()` and uses it for one thing, the order it
  applies the batch in; the local queue needs to insert **before** an existing operation, and the
  counter only goes up. Renumbering the queue instead would move an operation past a later edit of
  the same row, and moving the target later would break the chain it belongs to.
- **Alternatives:** integer gaps reserved up front (does nothing for a queue already numbered);
  renumbering on insert (`seq` is the primary key of the store, the rollback map's key and what the
  tray and the sheet address an operation by).
- **Consequence:** results are matched back by `opId`, never by `seq`, and nothing local reads `seq`
  as anything but an order.

## 2026-09-06 · Inside one batch, only the first operation of a row is guarded (O-F5b)

- **Decision:** when a batch carries several operations of the same row, only the first one sends
  `baseUpdatedAt`; the rest travel unconditional.
- **Why:** they were all queued against the stamp the first one is about to replace (D-22), and a
  batch has no gap in which to rebase them — they would earn a `conflict` `STALE_UPDATE` that means
  nothing. Unguarded they are still safe: `POST /sync` blocks by entity id, so if the first one
  conflicts or is refused, the rest come back `blocked` without being applied (D-30).
- **Alternatives:** one operation per row per batch (splits the queue into more requests in exactly
  the case the batch existed to fix); guessing the stamp the previous operation will produce (the
  client does not write `updatedAt`, invariant 2).
- **Consequence:** the owner approved it on 2026-09-06. Across batches the old rebase still applies.

## 2026-09-06 · An answer the queue cannot act on belongs to the form that is waiting for it (O-F5b, D-35)

- **Decision:** a `conflict` that is not `STALE_UPDATE` — a name already taken, a reference the server
  will not take, an id of another user — and a `merged` are handed to the form that is still waiting
  for the write, as the 4xx its route would have answered (`code`, `message`, `current`); only when
  nobody is waiting do they go to the tray as `conflict`. `STALE_UPDATE` on money or structure goes to
  the sheet even with a form open (D-23). What decides is the undo the write registered: `write()`
  keeps it while it waits for the drain and drops it the moment it answers the screen from the
  projection, so a refusal that arrives in a later drain leaves the operation `failed` in the tray
  instead of undoing a write nobody is looking at (F-23, which until now covered only the dead tab).
- **Why:** `test:e2e` found it — with the batch, a `409 DUPLICATE` that used to reach the form became a
  `conflict` in a tray the user had not opened, and the form believed the row was saved. A taken name
  is fixed by typing another one, where the user is. And the undo is already the exact signal: `write()`
  awaits the whole pass, so "an undo is registered" is "`write()` has not returned yet".
- **Alternatives:** a flag in the envelope saying a form waits (a field the server does not use, to
  tell the queue what it already knows); always the tray (the form lies about a save it did not make);
  always the form (a refusal after a reload has no form, and undoing then would erase a write the
  user thinks is saved).
- **Consequence:** `awaited(seq)` in the engine reads the rollback map; `write()` and `writeAll()` call
  `forgetRollbacks` before answering from the projection. Reviewed and confirmed in R-4.

## 2026-09-06 · A warning lives with the row it explains, in `meta` (F-57)

- **Decision:** `warnings: ["CATEGORY_ARCHIVED_DROPPED"]` on a landed operation is kept as one notice
  per row in `meta.syncNotices` (JSON), and the **review screen** reads them and prunes what no longer
  needs a review.
- **Why:** the write landed, so there is nothing to resolve in the sync tray — and with an empty queue
  the tray is not even reachable. The user meets the movement where the missing category has to be
  filled in, and that is where the reason belongs.
- **Alternatives:** an object store of its own (a mirror version bump, and a re-pull, for a handful of
  notices); a toast (a drain can happen with no tab open); a field on the mirror row (the next pull
  replaces the row, and inventing a server field would be a lie).
- **Consequence:** one more `MetaKey`. A notice outlives its row by nothing: `pruneNotices` drops it
  as soon as the movement is reviewed, deleted or gone from the mirror.

## 2026-09-06 · The browser suite builds into its own directory and its own worker (F-56, O-F7)

- **Decision:** `next.config.ts` reads `distDir` from `NEXT_DIST_DIR`, `serwist.config.mjs` reads
  `swDest` from `SERWIST_SW_DEST`, and the app registers `env.NEXT_PUBLIC_SW_PATH`. `playwright.config.ts`
  sets the three to `.next-e2e`, `public/sw-e2e.js` and `/sw-e2e.js`, so `npm run test:e2e` and
  `npm run demo:offline` never write the `.next` or the `public/sw.js` that a `next start` is serving.
- **Why:** on 2026-09-05 four Playwright runs rebuilt `.next` under the owner's running app and his
  screen broke apart (tabs that stopped reacting, chunks that no longer existed); and the e2e worker,
  built with `NEXT_PUBLIC_APP_ENV=test` and other hashes, stayed in `public/sw.js` and made his browser
  precache another build's URLs.
- **Alternatives:** a separate checkout (`git worktree`) for the suite — a second `node_modules` and a
  second install to keep in step; telling every session not to run the suite while the app is up (the
  rule that was in force, and it depends on remembering it).
- **Consequence:** three defaulted environment variables, and the worker path is public env instead of a
  literal. `npm run ci` builds through `build:gate` (`.next-gate`, `public/sw-gate.js`), so `.next` and
  `public/sw.js` are written only by a plain `npm run build` — the owner's. `globIgnores` drops
  `public/sw*.js` from the precache manifest, so no build precaches another's worker. `next build`
  rewrites `next-env.d.ts` to point at whichever `distDir` it used; both files are git-ignored and
  `npm run ci` runs `next typegen` first, which puts it back.

## 2026-09-06 · An edit sends what the user changed, and nothing else (O-F7)

- **Decision:** the three edit forms (transaction, account, category) send only the fields the user
  touched. `lib/form/changes.ts` (`changedOnly`) does it where the form field and the request field
  are the same name; `toTransactionChanges` does it for the transaction form, where they are not
  (`date` + `time` → `date`, the type and the account pickers → both account sides). Every
  `form.setValue` the screens make on the user's behalf now passes `{ shouldDirty: true }`.
- **Why:** the queue classifies a conflict by the fields the operation carries (§6 O-F5a): text-only
  edits rebase themselves, anything with money or shape is asked about. A body that always named the
  amount and the date made **every** disagreement between two devices a money question, and the
  winner overwrote fields the other device had changed — the exact opposite of §1 example 3 of the
  offline plan, where a rename on the tablet and a note on the phone combine without a word. Found by
  `tests/e2e/offline-two-devices.spec.ts`, which failed until this.
- **Alternatives:** diffing the built request against the row that was loaded — the date does not
  survive the round trip through the form's day and time fields, so it would always look changed;
  classifying by "field present but equal to the server's" in the queue — the server's version is
  exactly what a stale operation does not have.
- **Consequence:** an untouched form has nothing to send, and sends nothing (`nothingChanged`): every
  `PUT` of the API refuses an empty body with `400` "At least one field must be provided", so `{}`
  would fail online and, offline, sit in the attention tray for having changed nothing (R-5 §A).
  `dirtyFields` is read during render because React Hook Form's `formState` is a Proxy that only
  tracks what the component subscribed to — reading it first inside the submit handler answers `{}`.

## 2026-09-06 · A sheet's body can be scrolled with the keyboard (O-F7)

- **Decision:** the scrollable body of `components/ui/Sheet` takes a tab stop **only when nothing
  inside it can take one**, measured on open and again whenever its children change.
- **Why:** axe's `scrollable-region-focusable` (serious) on the "Resolve sync conflict" sheet, whose
  body is two cards with no control in them: its footer buttons are outside the scroll area, so a
  keyboard could not reach the content at all. Every sheet shares the container; the ones whose body
  holds a form passed only because their fields happened to be focusable.
- **Alternatives:** a tab stop on every sheet — it lands in front of the search box of every picker,
  and `pickers.spec.ts` said so; a prop each sheet sets by hand — the same question answered again in
  every call site, and wrongly the day a body changes.
- **Consequence:** one `querySelector` per open. The axe check in
  `tests/e2e/offline-two-devices.spec.ts` is what keeps it.

## 2026-09-06 · An answered request is proof of a network; the heartbeat still decides (F-64)

- **Decision:** `lib/api/client` reports every response it receives — any status — to
  `reportNetworkAnswer()`, and while the connectivity store believes the app is offline that report
  asks the heartbeat for a health check **now** instead of waiting for its next 30 s tick. Online,
  the call returns immediately and costs nothing.
- **Why:** a session that died with the app open announced itself only after the store learned the
  network was back, and the store learned it from the heartbeat (or the browser's `online` event,
  which does not always fire). Measured in the browser: the first request after the network returned
  was answered at **36 ms** with a `401`, and the sheet that says "Sign in to sync" appeared at
  **30 058 ms** — one whole tick later, with the strip still saying "You're offline." and the queue
  stopped with no explanation. The 401 plumbing was never the problem (F-64 suspected it was): the
  app simply did not know it was online. With the report, the same run announces in ~3 s.
- **Alternatives:** letting a response set the phase directly — a response can come from the service
  worker's cache, and the store's rule since W-19 is that only `/api/health` decides; a shorter
  heartbeat while offline — more requests for every device that is really offline, which is the case
  the interval exists for; announcing the dead session without a network — asking someone with no
  connection to sign in, which is what `SessionExpiredSheet` deliberately refuses to do.
- **Consequence:** the worst case goes from one heartbeat interval to one health request, for
  everything that waits on the phase: the strip, React Query's `onlineManager`, the outbox engine and
  the sign-in sheet. `tests/e2e/offline-hardening.spec.ts` asserts the sheet inside 15 s — well under
  the tick — so a regression cannot hide behind the interval again.

## 2026-09-06 · A dead session has a stripe of its own, and the sheet closes for good (F-41)

- **Decision:** the connection stripe gains a fifth state, `signedout` (amber, `log-in`, permanent
  while it lasts): "You're signed out. Nothing is syncing." with the count of what is saved here and
  "Sign in to sync" → `/login?reauth=1`. Ajustes › Sync status gains a fixed first row, **Session**,
  that says `Active` or `Signed out` and carries the same way back. `SessionExpiredSheet` takes an
  `onClose` that really closes: in local mode the X, `Escape` and the scrim dismiss the sheet and
  leave the stripe behind, instead of walking to the login as `onClose = onSignIn` made them.
- **Why:** with a vault on the device a dead session is not a wall — the app reads and queues — but
  once the sheet was dismissed the only route back to the login was "Sign out", which is exactly what
  must not be done with a queue on the device. The stripe warns without being looked for; the row
  answers whoever went to look, and a screen that lists what this device owes the server cannot stay
  quiet about there being nobody to say it to.
- **Alternatives:** only the stripe (Sync status would keep lying by omission); only the row (nobody
  opens Settings to discover a problem they have not been told about); keeping the sheet
  undismissable (D-7: the app has to keep working).
- **Consequence:** `ConnectionBanner` takes `signedOut` and `onSignIn` from the frame that already
  knows both, so it stays testable without a session provider. **The stripe now follows the priority
  DESIGN.md §8.12 declares** — `offline` → `signedout` → `error` → `pending` → `online` — which moves
  `error` below `offline`: with no network nothing can be signed in or sent, and resolving a conflict
  changes nothing until there is a session to send it with.

## 2026-09-06 · "Offline ready" is two halves, and the page counts them itself (F-54)

- **Decision:** Ajustes › Sync status gains a fixed **Offline ready** row — `Ready` /
  `Preparing… · n of 25 screens` / `Incomplete` with a `Retry` — and a device announces itself once,
  ever, with a toast ("Ready to use offline" · "What this means" → Sync status). Ready means both
  halves: the pull wrote `syncedAt` into the vault **and** the worker's `app-shell` cache holds all
  25 screens of `shellUrls()` for the language in use.
- **Why:** the copy and the screens are fetched in the background on the way in and nothing said
  when they landed; "Last synced" spoke for the data alone. Counting the keys the warm should have
  left answers the same question a message to the worker would, without a protocol to keep in step,
  and it is locale-aware on purpose: a device warmed only in Spanish is not ready for English.
- **Alternatives:** a state of the connection stripe — rejected in design, the stripe is for what is
  going wrong and its green is already "Back online"; polling readiness on a timer — §4.2 has no
  periodic anything, so the worker now answers `SHELL_WARMED_MESSAGE` when it has been through the
  list and the page checks on that and on mount.
- **Consequence:** `warmAppShell` gained a reply, and the shell knows how many screens it owes
  (`SHELL_SCREENS`). The two halves can land in either order, so a device that finishes its pull
  after the warm announces itself on the next visit rather than the current one; the fixed row is
  always right in the meantime. The "announced" flag is a single boolean in `localStorage`, per
  device and per origin, and a browser that refuses storage would say it again rather than never.

## 2026-09-06 · A restore refused for its name is renamed where it is read (F-60)

- **Decision:** an `account:restore` / `category:restore` the server refused with `DUPLICATE` gets
  its own shape in both places: the tray card carries the badge "Name taken", the reason that names
  who holds it, and **"Restore with another name"** as its primary way out; the conflict sheet shows
  the two comparison cards ("On the server · has the name" from the `current` the backend answers
  with since `9446bb5`, and "On this device · being restored") with the rename **embedded** —
  a "New name" field pre-filled with "{name} (old)" and `Restore as “…”`. `restoreWithName` puts the
  same operation back in line with `payload.body.name` changed. **"Try again" is not offered**, and
  the sheet says why.
- **Why:** the restore route already takes a `name`, so this is the one refusal the app can walk the
  user out of; offering "Try again" spends a round trip to be told the same thing.
- **Alternatives:** opening the rename sheet of §7.27 on top of the conflict sheet — two dialogs for
  one decision, and the comparison that explains the rename disappears behind the second; renaming
  the row first and retrying — that is two writes for what the route does in one, and the first
  would be refused too while the row is still archived.
- **Consequence:** the restore's body carries no fields, so the comparison is built for it from the
  mirror's row and the refused row rather than from `conflictFields`. The refused row is dropped
  from the operation when it goes back in line: it was never this row's baseline (`ownServerRow`
  refuses it), and dropping it is what takes the sheet out of the "name taken" state. The mirror
  shows the new name from the moment it is chosen, because the reprojection of `restore` merges the
  body.

## 2026-09-06 · The device learns how far its clock runs from the server's (F-66)

- **Decision:** every answer that carries a `serverTime` — `POST /sync` and each page of
  `GET /sync/changes` — teaches the device the distance between the two clocks. It lives in a store
  the screens subscribe to and, over a minute of movement, in the vault's `meta`, which is what makes
  it readable on the next cold start. Two screens use it: the movement form warns above the date when
  the device runs more than an hour ahead (the preventive half of trap 7.4), and a `FUTURE_DATE`
  refusal turns the conflict sheet into **"Fix the date"**, prefilled with the server's own time and
  saying which date was refused, with **"Save and try again"** as the way out. The tray card leads
  with "Fix the date" and keeps "Try again" last.
- **Why:** the form's guard runs on the only clock it has, so a device three days ahead accepts what
  the server refuses and says so only once the queue is stuck. And a refused creation cannot be
  edited from the list — the row exists nowhere else — so the sheet was the only place left to
  correct it. Both halves were in the plan (trap 7.4); only the offset half had been built.
- **Alternatives:** correcting the date to the device's own clock — the same clock that caused the
  refusal; sending the offset with the write so the server could fix it — the server refuses, it does
  not negotiate, and D-32 keeps validation whole; keeping the offset in memory only — it is needed
  exactly when there is no network to learn it again.
- **Consequence:** `retryWithDate` rewrites `payload.body.date` and puts the same operation back in
  line, so it stays the same creation, with the same `opId` and the same dependents behind it — the
  sheet says how many. A device that runs _behind_ the server is not warned: the dates it writes are
  in the past, which the server takes.

## 2026-09-06 · A queue an app update left behind is visible, and the app keeps writing (F-65)

- **Decision:** `openVault` already answered `outbox: "blocked"` and a count; it now also names the
  operations, `startMirror` publishes them into the outbox status, and three screens read them: the
  sixth stripe of §8.12 (`blocked`, red, `role="alert"`, "An app update stopped n changes from being
  sent." with "See them"), an alert plus a `n · blocked` value on "Waiting to send" in Sync status,
  and a section of its own in the tray with "Discard this change" / "Keep it here" and a batch
  discard. **The app keeps writing normally**: nothing is queued behind a blocked operation, and
  nothing new is refused because of one.
- **Why:** the plan (§6 O-F1) promised "the schema upgrade is blocked until the queue drains **and
  the user is told**", and only the first half existed. Blocking the record instead would punish the
  user for an update they did not ask for, and the new work does not depend on the old.
- **Alternatives:** discarding what cannot be migrated (invariant 7: unsent work is never thrown
  away without the user saying so); folding them in with the refusals (they were never refused —
  the server has not seen them — so "Try again" would be a lie).
- **Consequence:** a blocked operation is `pending`, so `discardOperations` (which only admits what
  the server refused) does not take it; `discardBlockedOperations` shares its machinery, cascade
  included. "Keep it here" changes nothing on the device by design, so the card marks itself kept
  for the visit and stops asking — the operation stays for a future version that knows how to
  migrate it, which is what the button promises. Today nothing is ever blocked: `OUTBOX_MIGRATIONS`
  is empty and `OUTBOX_VERSION` is 1, so this is the screen the first bump will need.

## 2026-09-06 · The green stripe counts what the round drained (F-62)

- **Decision:** "Back online." carries a second line, "n changes synced", counting what the last
  round actually settled with the server — `sent`, `landed`, `gone`, `merged` and `absorbed`. A round
  that settled nothing paints no line: the stripe never says "0 changes synced".
- **Why:** the amber stripe says "2 changes waiting", and until now the only sign the queue had
  emptied was that stripe disappearing. The text has been in `messages/` since W-19 (owner's choice,
  2026-09-06: variant B).
- **Alternatives:** counting how much the queue shrank — a write undone before it left would count as
  synced; leaving `absorbed` out — two edits to one row that travel as one request would say "1
  change synced" after "2 changes waiting", which is the arithmetic the user cannot follow.
- **Consequence:** the count is set by each round, never accumulated, so it is the last round's
  answer and nothing older. `cancelled` is excluded on purpose: it never reached anyone.

## 2026-09-06 · Dates and times are the app's own controls, not the browser's (F-05)

- **Decision:** `DateTimeField` stops rendering `<input type="date">` and `<input type="time">`. Each
  half is an opener drawn like the input it replaces, and it opens a sheet of 7.28: a 7×n calendar
  with "Today" / "Yesterday" chips, the month's neighbours at 55 %, keyboard movement (arrows a day,
  `PageUp`/`PageDown` a month) and the days past the ceiling disabled; and a wheel of hours and
  minutes (in fives) with "Now", plus an AM/PM column where the language reads time that way. A new
  `DateField` serves the places that ask for a day alone: the range of the filters sheet (§8.5) and
  the budget's dates (§8.8). This reverses the decision of 2026-09-01 that date and time were the one
  place native controls were allowed.
- **Why:** the browser's widgets follow neither the tokens nor the app's language, and — the reason
  that decided it — they cannot grey out what the server refuses. The transaction form passes
  `max` = tomorrow, so a date more than 24 h ahead is no longer reachable from the form at all; the
  budget's period, which is legitimately in the future, passes no ceiling.
- **Alternatives:** styling the native control (nothing in it can be styled past the border);
  validating after the fact (which is what F-66 exists to clean up afterwards).
- **Consequence:** every day the calendar shows carries its whole date as its accessible name, so a
  screen reader hears "Wednesday, September 30, 2026" and the neighbour months are told apart. The
  sheets are remounted on each open, which is what makes "Cancel" leave nothing behind. Two e2e tests
  changed shape: the far-future date of `transaction-form.spec.ts` cannot be typed any more, so the
  test asserts the calendar refuses it, and the inverted budget window of `BudgetForm.test.tsx` is
  now a day the picker does not offer.

## 2026-09-06 · The account type is one row and a sheet that explains the nine (F-03)

- **Decision:** the grid of nine chips is replaced by a `picker` row — "Type · Bank account · a
  checking or current account" — that opens a sheet listing the nine types, each with the line that
  says what it is. The same control serves the account form and the onboarding, which reach it
  through the same `AccountForm`. Variant C, chosen by the owner on 2026-09-06.
- **Why:** the grid broke into three lines and took half the screen, and it had nowhere to say what
  an Overdraft is — which is the thing nobody could work out. A row is one line whatever the type,
  and it scales if a tenth type ever appears.
- **Alternatives, both drawn in `preview/13-variaciones.html` with the reason they lost:** a single
  scrollable line of nine chips (dragging with a mouse is awkward and the last types are never
  discovered); five essentials plus "More" (the four odd types hide behind a button, in a sheet
  different from the rest of the form).
- **Consequence:** the description is written once, capitalised, and the row lowercases its first
  letter to read as a clause. Two e2e tests and two component tests choose the type through the sheet
  now.

## 2026-09-06 · The pace mark says what it marks, and explains itself once (F-08)

- **Decision:** the vertical line on a progress bar becomes a focusable `button` carrying its own
  `aria-label` and a tooltip — "Day 22 of 30 · 73% expected" — wherever the mark is drawn: the Home
  hero, the global budget card and the budget detail. **Only the detail** repeats it as a fixed line
  under the bar ("The mark is today's pace: …"). Variant B, chosen by the owner on 2026-09-06.
- **Why:** the line had no label at all, so it was decoration to anyone who had not been told. The
  tooltip does not exist for a finger, which is why the one screen with room says it in text; on the
  list and the hero the same line would repeat on every card.
- **Alternatives:** the tooltip alone (variant A: a phone never sees it); a legend everywhere (noise
  on every card, and it does not fit).
- **Consequence:** `Progress` no longer clips the mark: the bar keeps its own `overflow-hidden` for
  the fill, and the mark and its bubble sit outside it, so the tooltip is not cut off by the element
  it explains. A mark with no label stays a decorative line — that is what the landing's mock uses.
  `budgetProgress` gained `day` and `days`, which is what the text says out loud.

## 2026-09-06 · The language is chosen before the account exists (F-02)

- **Decision:** the access frame gains a language chip (globe + `EN` / `ES`) beside the brand on
  login, register and onboarding, and the register form a **Language** row. Both open the same sheet
  — English and Español, the device's own marked "Detected from your device" — and both do the same
  thing: navigate to the same page in the other language. There is no third value to keep in step,
  because the language of the screen **is** the `locale` the account is created with. No "Follow
  device" here: that is a local mode of Settings, not a value the contract takes.
- **Why:** `locale` was whatever the URL happened to carry, and nothing on the screen said so or
  offered to change it. Someone who lands on `/en/register` from a shared link had to know to edit
  the address bar.
- **Alternatives:** swapping the messages in place without navigating — the URL would still say
  `/en`, so every `Link` on the page and the onboarding it hands over to would carry the wrong
  language; keeping a separate `locale` field in the form — two values saying the same thing, and the
  screen would still be in the other language while the user filled it in.
- **Consequence:** switching on the register screen reloads it in the other language, which empties
  what was typed — the same thing that happens in Settings, and the reason the row shows the detected
  language, which is what most people will already want. The switch carries the query string with it,
  so a `?reauth=1&next=…` login does not lose its way back (§2.6).

## 2026-09-06 · The landing's footer link is reached by keyboard, not by coordinates (F-37)

- **Decision:** `public.spec.ts` asserts the footer's privacy link and then activates it with the
  keyboard (`focus()` + Enter) instead of clicking it.
- **Why:** the failure was neither an animated footer nor a flaky wait, which is what the ficha
  assumed. Measured: the landing is 2370 px tall, Chromium's mobile emulation gives the page a layout
  viewport of 935 px while Playwright measures in the 839 px visual viewport, and at the very bottom
  of the page that ~96 px difference puts the computed click point inside `section#how` instead of on
  the link — the browser's own `elementFromPoint` agrees with the interception message. Nothing moves
  and nothing overlaps: the two sides simply hit-test in different coordinate spaces. Desktop, which
  has no such split, never failed.
- **Alternatives:** `click({ force: true })` (dispatches at the same wrong point, so the URL would
  not change); asserting the `href` alone (it would stop proving the link works); making the footer
  taller (a 96 px offset would still miss a 15 px link).
- **Consequence:** the assertion is stronger than it was — a footer link has to answer the keyboard —
  and it is immune to the emulation's offset. Anything else that clicks near the bottom of a long
  page on the mobile project can fail the same way; that is worth remembering when reading F-45.

## 2026-09-06 · The three intermittents of the suite, each with its own cause (F-45, F-11)

- **Decision:** every full-page axe scan goes through `expectNoAxeViolations`, which waits for the
  document's title before judging it; the account deletion of `settings.spec.ts` waits 30 s instead
  of the default 5; and `offline-shell.spec.ts` waits for the screen after landing on `/home`, not
  only for the load event.
- **Why, one by one:** (a) the "43 violations" were one — `document-title` on `html` — and the page
  had its title a moment later: Next sets it after a client navigation, and under eight workers axe
  won the race. Reproduced three times out of three on `budgets.spec.ts`, not once when run alone.
  (b) Deleting an account is a round trip, a vault purge and a navigation; 5 s is not enough under
  load, and the ficha had already measured it. (c) "Navigation is interrupted by another navigation
  to /home" was the app's own start-up navigation, which happens once the client mounts — after the
  load event the test was waiting for.
- **Consequence:** measured after the fixes, the four specs that used to fail passed **72 of 72** and
  then **96 of 96** with `--repeat-each=3` and eight workers, and the full suite passed twice in a
  row: **145 passed / 0 failed / 1 skipped**. That is the new baseline, and it is the first time the
  suite has had no standing failure. F-11 is closed with F-45: the `document-title` half is this, and
  the `ECONNRESET` half has not reappeared in any of these runs.

## 2026-09-06 · Neither the tray nor the subscribed rows need the cap they were offered (F-35, F-36)

- **Measured in Chromium, before touching anything, with the vault seeded through IndexedDB and the
  app offline** (desktop project of the e2e suite; the spec was temporary and is not kept):
  - **F-35 — 200 stuck operations in `/sync`:** 200 cards, three buttons each, painted and
    interactive **304 ms** after the navigation, with **no long task** in the following 1.5 s.
  - **F-36 — 300 rows subscribed to `useOutbox()`:** with one page of rows on screen a write costs
    **599 ms** end to end; with all ten pages — 300 rows in the DOM — the same write costs **627 ms**,
    and again **no long task**. The 5 % difference is inside the noise of opening a sheet, typing and
    saving.
- **Decision:** neither the 50-card cap with "n more" of F-35 nor the memoisation of F-36 is built.
  Both were offered as "measure first", and the measurement says the user cannot tell.
- **Consequence:** the two fichas close on evidence rather than on a change, and the numbers are
  written down so the next person does not have to guess. The cap remains the answer if a real device
  ever says otherwise — and it is UI, so it would go through design first (D-36).

## 2026-09-06 · The authenticated app gets a budget that matches a real route (F-10)

- **Decision:** `tools/size-limit.mjs` budgets **every** `(app)` screen against one limit, reports the
  heaviest, and fails when a budget matches no route at all. The `(app)` limit is **250 kB gz**, the
  measured weight of the heaviest screen plus room.
- **Why:** the old pattern was `/(app)/page`, and the group has no `page.tsx` of its own — every
  screen is a segment below it — so it matched nothing, printed nothing and watched nothing from W-01
  until now. A budget that can silently match nothing is worse than no budget, which is why matching
  nothing is now a failure.
- **Measured:** the 25 screens sit between **230.5 and 239.9 kB gz** of route-owned JS, on top of a
  131.2 kB framework runtime that is reported separately. They are all within 10 kB of each other
  because they share the shell, the providers, the message catalogue and the offline stack. The
  200 kB the file carried was an aspiration nothing had ever been measured against; **the app has
  never been under it**, and pretending otherwise by keeping the number would leave the check red
  from its first honest run.
- **Consequence:** growth is caught from here on. Whether 240 kB is where the app should sit is a
  separate question, registered as its own finding.

## 2026-09-06 · Lighthouse runs on a Linux browser with a profile outside the repo (F-12)

- **Decision:** `npm run lighthouse` goes through `tools/lighthouse.mjs`, which passes
  `--user-data-dir` under the system temp directory and, when nothing else names a browser, points
  `CHROME_PATH` at the Linux Chromium Playwright already installs. The profile is removed when the run
  ends.
- **Why:** under WSL `chrome-launcher` reaches the Windows browser through `/mnt/c` and hands it a
  Linux profile path it cannot translate, and the browser creates a directory literally named
  `C:\Users\…` wherever the command was run — the repo root, one `git add .` away from a commit.
- **Honest about the reproduction:** the stray directory could not be produced on this machine today,
  because no Windows _Chrome_ is installed here any more (only Edge, which `chrome-launcher` does not
  pick) — `npx lhci autorun` now fails outright with "Chrome installation not found". So the fix is
  verified in what it does, not in the failure it prevents: with it, the run finds a browser, all four
  URLs pass their assertions, and the repo root is untouched afterwards.
- **Consequence:** the command works on a WSL checkout with no Chrome of its own, which it did not
  before, and CI (which sets `CHROME_PATH` and has a real Chrome) is unaffected beyond the temp
  profile.
