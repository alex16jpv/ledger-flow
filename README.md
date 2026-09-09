# Ledger Flow

Web client for Ledger Flow, a personal finance app built to catch small daily spending.
Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4.

## Requirements

- Node 24 (`.nvmrc`), npm 11.
- The backend (`lag-money-manager`) running locally with its MongoDB replica set:
  `npm run start:dev` in that repo, listening on `http://localhost:3000`.

## Getting started

```bash
nvm use
npm install          # also installs the git hooks (lefthook)
cp .env.example .env.local
npm run dev          # http://localhost:3001
```

## Environment variables

Validated at build time by `lib/env.ts` (`@t3-oss/env-nextjs` + Zod); a missing variable fails
the build. `SKIP_ENV_VALIDATION=1` skips the check for tooling that has no environment.

| Variable                                            | Scope  | Purpose                                                                                             |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `API_URL`                                           | server | Backend base URL. Only the BFF knows it.                                                            |
| `API_SECRET`                                        | server | Shared secret sent as `x-api-secret` on every backend call; the backend requires it in production.  |
| `NEXT_PUBLIC_APP_URL`                               | public | Base URL of this deployment (metadata, sitemap, manifest).                                          |
| `NEXT_PUBLIC_CONTACT_EMAIL`                         | public | Contact, support and privacy mailbox.                                                               |
| `NEXT_PUBLIC_APP_VERSION`                           | public | Tag or commit SHA shown in Settings › About.                                                        |
| `NEXT_PUBLIC_APP_ENV`                               | public | Optional feature-flag environment when it differs from `NODE_ENV` (the e2e build uses `test`).      |
| `NEXT_PUBLIC_SW_PATH`                               | public | Worker the app registers; defaults to `/sw.js`. The e2e build uses `/sw-e2e.js` (F-56).             |
| `NEXT_DIST_DIR`                                     | build  | Where `next build` writes; defaults to `.next`. e2e uses `.next-e2e`, the gate `.next-gate` (F-56). |
| `SERWIST_SW_DEST`                                   | build  | Where `serwist build` writes the worker; defaults to `public/sw.js`.                                |
| `NEXT_PUBLIC_SENTRY_DSN`                            | public | Optional. Enables Sentry error tracking (client, server and edge); unset keeps the SDK disabled.    |
| `NEXT_PUBLIC_VERCEL_ENV`                            | public | Set by Vercel (`production`, `preview`, `development`); used as the Sentry environment.             |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | build  | Deploy pipeline only: source-map upload during `next build`. Absent locally, the build skips it.    |

## Scripts

| Script                     | What it does                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`              | Next dev server on port 3001                                                                   |
| `npm run build` / `start`  | Production build (`next build` + `serwist build` → `public/sw.js`, git-ignored) / server       |
| `npm run ci`               | Full gate: typecheck, lint, format:check, check-tokens, contrast-check, test, `build:gate`     |
| `npm run build:gate`       | The gate's build (`.next-gate`, `public/sw-gate.js`), then `size-limit` and `check-dev-routes` |
| `npm run check-dev-routes` | Starts the gate build on port 3004 and proves the dev-only URLs answer 404 (W-39)              |
| `npm run typecheck`        | `tsc --noEmit`                                                                                 |
| `npm run lint`             | ESLint with zero warnings allowed                                                              |
| `npm run format`           | Prettier (`format:check` verifies)                                                             |
| `npm run check-tokens`     | Fails on hex, raw color functions or Tailwind palette classes                                  |
| `npm run contrast-check`   | WCAG AA over every `tokens/palette.*.css` in light and dark                                    |
| `npm run test`             | Vitest + Testing Library (`test:watch`, `test:coverage`)                                       |
| `npm run test:e2e`         | Playwright smoke tests against the local backend                                               |
| `npm run e2e:backend`      | Starts the sibling backend on port 3200 against the Docker Mongo `lag_money_test`, seeded      |
| `npm run demo:offline`     | The demo of gate O-A: three days with no network and one clean drain (`tests/gate/`)           |
| `npm run demo:offline:b`   | The demo of gate O-B: two devices, a conflict and the tray that resolves it                    |
| `demo:offline:watch`       | The same demos, headed and slowed down, so they can be watched as they happen (`:b:watch`)     |
| `demo:offline:report`      | Opens the demo's report: one video per cold start, and a trace with every request              |
| `npm run measure:banner`   | Times the pending stripe against a slow network (`tests/measure/`, F-72)                       |
| `npm run size-limit`       | Route JS budgets over the production build                                                     |
| `npm run lighthouse`       | Lighthouse CI against a production build with the thresholds in `lighthouserc.json`            |
| `npm run lighthouse:app`   | The same, over the 25 authenticated screens with a real session (`lighthouserc.app.json`)      |
| `npm run gen:api-types`    | Regenerates `types/api.d.ts` and `endpoints.md` from the backend OpenAPI                       |
| `npm run fixtures:sync`    | Refreshes the backend's parity fixtures under `lib/local/derive/fixtures/`                     |
| `npm run gen:feature`      | Scaffolds `features/<name>/{api,keys,hooks,schemas,components}`                                |

## Deploy

Three environments: `development` (local backend), `preview` (one per PR) and `production`, all on
Vercel from this repo (Node from `.nvmrc`, `npm run build` runs `next build` and the Serwist step).
`main` is protected (PR + green CI) and deploys production; every pull request gets its own preview,
and `ci.yml` also runs on pushes to `feat/**`. Production is cut from a tag: bump `version` in
`package.json`, move the `Unreleased` notes in `CHANGELOG.md` under the version, `git tag -a vX.Y.Z`
and push the tag.

Variables per environment (Vercel › Settings › Environment Variables):

| Variable                                            | Production                          | Preview                               |
| --------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `API_URL`                                           | deployed backend URL                | staging backend URL                   |
| `API_SECRET`                                        | backend shared secret               | staging secret                        |
| `NEXT_PUBLIC_APP_URL`                               | `https://ledgerflow.alexpiral.com`  | unset: falls back to the branch alias |
| `NEXT_PUBLIC_CONTACT_EMAIL`                         | `ledgerflow@alexpiral.com`          | same                                  |
| `NEXT_PUBLIC_APP_VERSION`                           | unset: falls back to the commit SHA | same                                  |
| `NEXT_PUBLIC_SENTRY_DSN`                            | Sentry project DSN                  | same DSN (events land as `preview`)   |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | source-map upload                   | same                                  |

Vercel exposes `NEXT_PUBLIC_VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_BRANCH_URL` and
`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` when "Automatically expose System Environment Variables" is on.
Previews send `x-robots-tag: noindex` on every response and a `robots.txt` that disallows all.
Production adds `Strict-Transport-Security` (2 years, `includeSubDomains`, `preload`); submit the
domain at hstspreload.org once it has served HTTPS for a while. Changing the domain means a new
`NEXT_PUBLIC_APP_URL` plus permanent redirects from the old one in Vercel.

CI (`.github/workflows/ci.yml`): `quality` (typecheck, lint, format, tokens, contrast, tests,
build, size budgets, `npm audit`), `security` (gitleaks, osv-scanner), `e2e` (Playwright against
the backend repo on an ephemeral Mongo replica set; needs the `BACKEND_REPO_TOKEN` secret) and
`lighthouse` (`lighthouserc.json`: performance ≥ 90, accessibility ≥ 95, best practices ≥ 90,
SEO ≥ 95 on the public pages; the report is uploaded as an artifact). The 25 authenticated screens
have a workflow of their own, `lighthouse-app.yml`: it checks out both repos, brings up the replica
set and runs `npm run lighthouse:app` with a real session. It is `workflow_dispatch` and not
nightly on purpose — the audit fails by design while F-78 is open (performance 78–86, accessibility
100 on all 25), and a job that goes red every night is a job everyone learns to ignore.

## Structure

```
app/                 routes (App Router). Pages are shells that compose a feature view.
components/ui/       the design-system components (DESIGN.md §7); no data access
components/shell/    AppShell, Sidebar, TabBar, Fab, PageHeader, ConnectionBanner
features/<domain>/   api.ts · keys.ts · hooks.ts · schemas.ts · components/ · README.md
lib/api              HTTP client, ApiError, error taxonomy, idempotency, single-flight refresh
lib/query            QueryClient defaults and persistence
lib/local            offline vault: IndexedDB schema, migrations, storage grant, vault purge
lib/pwa              service worker registration, the (app) routes it caches and the offline fallback
lib/i18n             next-intl config, money and date formatting
lib/theme            palette and mode
lib/icons            curated Lucide map and CategoryIcon
lib/format           money and date windows in the user's timezone
lib/network          connectivity, the /api/health heartbeat and the offline hook
lib/session          the session context, its keys and the multi-tab channel
app/sw.ts            the Serwist service worker: precache, app-shell routes, Background Sync
messages/            en.json, es.json (the only place with user-visible text)
tokens/              design tokens, copied from auditoria/front/diseno/tokens
types/api.d.ts       generated from the backend OpenAPI (endpoints.md sits in the repo root)
tests/e2e            Playwright; unit tests sit next to the code (*.test.ts)
tests/gate           the recorded offline demos of gates O-A and O-B (npm run demo:offline)
tools/               check-tokens, contrast-check, size-limit, gen-api-types, lighthouse,
                     check-dev-routes, e2e-backend, sync-fixtures
```

Dependency direction: `app → features → components/ui | lib`. Never `features/a → features/b`;
shared code moves up to `lib` or `components/ui`. ESLint enforces it.

## Routes

English has no prefix, Spanish lives under `/es/...` (`localePrefix: as-needed`).

| Route                                                          | Screen                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/`                                                            | Public landing (static)                                                                                               |
| `/login`, `/register`, `/onboarding`                           | Access and first-run flow                                                                                             |
| `/home`                                                        | Authenticated home                                                                                                    |
| `/settings`, `/settings/appearance`                            | Settings hub (language, currency, time zone, your data, install, about, delete) and appearance                        |
| `/settings/profile`, `/settings/sessions`                      | Profile & security (name, email, password with re-authentication) and active sessions                                 |
| `/settings/sync`                                               | Sync status: cursor, queue size, last error, storage use and grant, display mode, link to the tray, force full resync |
| `/sync`                                                        | "Needs your attention": the queued changes the server refused, one card each, and the conflict sheet                  |
| `/transactions`                                                | Transactions list: filters in the URL, day groups, infinite scroll                                                    |
| `/transactions/new`, `/transactions/[id]/edit`                 | Transaction form: create (optional quick-add draft in the query string) and edit with delete                          |
| `/transactions/[id]`                                           | Transaction detail with edit and delete                                                                               |
| `/transactions/review`                                         | Inbox of quick expenses to complete (`?focus=<id>` scrolls to one)                                                    |
| `/accounts`                                                    | Accounts list: summary, active grid, folded archived section                                                          |
| `/accounts/new`, `/accounts/[id]/edit`                         | Account form: create (with opening balance) and edit                                                                  |
| `/accounts/[id]`                                               | Account detail: hero, make main, archive/restore, its transactions                                                    |
| `/categories`                                                  | Categories grid by type (`?type=`), usage counts, archived list, restore defaults                                     |
| `/categories/new`, `/categories/[id]/edit`                     | Category form: create (`?type=`) and edit with locked type and archive                                                |
| `/budgets`                                                     | Budgets list for a month (`?reference=YYYY-MM&period=`), global card featured                                         |
| `/budgets/[id]`                                                | Budget detail per month: hero, period override, categories, transactions, archive                                     |
| `/budgets/new`, `/budgets/[id]/edit`                           | Budget form: scope, categories, six period types, amount, color, advanced options                                     |
| `/budgets/past`                                                | Ended and archived budgets with "Create again"                                                                        |
| `/stats`                                                       | Monthly stats by category, day or tag (`?reference&type&groupBy`) with drill-down                                     |
| `/privacy`, `/terms`                                           | Privacy policy and terms of service (static, legal drafts pending the owner's review)                                 |
| `/dev/ui`                                                      | Component catalog (development only)                                                                                  |
| `/dev/pickers`                                                 | Category, account and date pickers against the real API (development only)                                            |
| `/dev/frame?w=390&url=…`, `/api/dev/login?email&password&next` | Screenshot helpers (development only)                                                                                 |
| `/api/auth/*`                                                  | Session BFF (httpOnly cookies)                                                                                        |
| `/api/[...path]`                                               | Generic proxy to the backend; logs one JSON line per call with the `requestId`                                        |
| `/monitoring`                                                  | Sentry tunnel (rewrite to the ingest host) so CSP keeps `connect-src 'self'`                                          |
| `/api/health`                                                  | Liveness the connectivity heartbeat polls (`lib/network`)                                                             |
| `/api/csp-report`                                              | Where the Content-Security-Policy reports land                                                                        |
| `/theme-init.js`, `/install-init.js`                           | Head scripts: palette and mode before first paint, and the install offer before the app hydrates (F-87)               |

Every screen of the app needs a session: `lib/auth/routes.ts` lists them and a unit test reads the
folders of `app/[locale]/(app)` to make sure none is missing (F-75). The development-only routes are
switched off by the `componentCatalog` and `devLogin` flags, and in a production build the proxy
answers 404 before anything renders — `npm run check-dev-routes` proves it on the build itself.

## How to

- **Add a feature:** `npm run gen:feature`, then fill `api.ts` (one function per endpoint),
  `keys.ts` (query-key factory), `hooks.ts` (React Query), `schemas.ts` (Zod for user input) and
  the view components. Add its message subtree to both `messages/*.json`.
- **Add a palette:** copy `tokens/palette.tinta.css`, change the selector to
  `:root[data-palette="<name>"]` and the 18 seeds, run `npm run contrast-check`, import it in
  `app/globals.css` and add the name to `PALETTES` in `lib/theme/palettes.ts`. The user's choice
  lives in `localStorage` (`lf.palette`, `lf.mode`) and is applied by an inline script before paint.
- **Use an icon:** interface icons are imported by name from `lucide-react` with `iconProps(size)`
  from `lib/icons`; category icons go through `<CategoryIcon icon={category.icon} />`, account
  types through `accountTypeIcon(type)`. Never add an icon key outside `CATEGORY_ICONS`.
- **Add a language:** add `messages/<locale>.json` with every key of `en.json` (the parity test
  enforces it), append the code to `LOCALES` in `lib/i18n/routing.ts`, add its default region in
  `lib/i18n/format-locale.ts`, and add the row in Settings › Language. The backend enum
  `user.locale` must accept it too.
- **Follow an error:** every API call carries an `x-request-id` (UUID v7) that the backend echoes
  and logs; failed screens print it as "Reference: …" and the BFF logs it as JSON. Search that id in
  the backend logs and in Sentry (tag `request_id`). Sentry events pass through
  `lib/observability/scrub.ts`: no user, bodies, query strings, cookies or long numbers ever leave.
- **Add copy:** every user-visible string is a key in `messages/en.json` and `messages/es.json`,
  nested by feature (`transactions.list.empty.title`). Use ICU plurals and rich tags; never
  concatenate fragments.

## Working rules

See `CLAUDE.md` (definition of done, hard rules) and `DECISIONS.md` (why things are the way
they are). Commits follow Conventional Commits with the backlog reference: `type(scope): subject (W-nn)`.
