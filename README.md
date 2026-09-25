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
| `npm run check:all`        | **The gate** (see [Checks](#checks)): `ci` + `audit` + `test:e2e` + `check:contract`           |
| `npm run ci`               | typecheck, lint, format:check, check-tokens, contrast-check, design:check, test, `build:gate`  |
| `npm run audit`            | `npm audit` over production dependencies, high severity and above                              |
| `npm run check:contract`   | Regenerates `types/api.d.ts` and fails on drift (needs the backend up)                         |
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
| `npm run lighthouse`       | Builds into `.next-lh` with the audited origin and runs `lhci` with `lighthouserc.json`        |
| `npm run lighthouse:app`   | The same, over the 25 authenticated screens with a real session (`lighthouserc.app.json`)      |
| `npm run gen:api-types`    | Regenerates `types/api.d.ts` and `endpoints.md` from the backend OpenAPI                       |
| `npm run fixtures:sync`    | Refreshes the backend's parity fixtures under `lib/local/derive/fixtures/`                     |
| `npm run gen:feature`      | Scaffolds `features/<name>/{api,keys,hooks,schemas,components}`                                |

## Test data and sessions

The e2e suite and the manual test bench both run against the backend's deterministic seed
(`npm run seed:test` in `lag-money-manager`, over the Docker Mongo `lag_money_test`). It creates
`seed@ledgerflow.test` / `LedgerFlow!2026` with accounts, categories, budgets and a year of
transactions.

In development only, `/api/dev/login?email=<email>&password=<password>&next=<path>` opens a session
and redirects, which is how screenshots and `/dev/pickers` are driven. These routes answer 404 in a
production build, and `npm run check-dev-routes` proves it in the gate.

`npm run test:e2e` starts the sibling backend on 3200 and this app on 3002. Baseline as of
2026-09-08: **161 passed, 0 failed, 1 skipped** — the skipped one is the long-press gesture, which
only exists on mobile.

## Deploy

Three environments: `development` (local backend), `preview` (one per PR) and `production`, all on
Vercel from this repo (Node from `.nvmrc`, `npm run build` runs `next build` and the Serwist step).
`main` deploys production and every pull request gets its own preview. Nothing gates a merge on
GitHub any more (see below): the gate is `npm run check:all`, run before the branch is handed over.
Production is cut from a tag: bump `version` in
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

## Checks

**Nothing runs on GitHub.** The workflows were deleted on 2026-09-13 by the owner's decision (T-34):
`ci.yml` had not passed a single run since the repository had one, and a red light nobody can act on
is worse than none. Every check lives here now:

| Command                  | What it covers                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm run check:all`      | **The gate**: the four below, in order, before handing a branch over                                |
| `npm run ci`             | typecheck, lint, format, tokens, contrast, design preview drift, unit tests, build, size budgets    |
| `npm run audit`          | production dependencies, high severity and above                                                    |
| `npm run test:e2e`       | Playwright against a real backend on a Mongo replica set                                            |
| `npm run check:contract` | regenerates `types/api.d.ts` and fails on drift (needs the backend up)                              |
| `npm run lighthouse`     | public pages against `lighthouserc.json`; `npm run lighthouse:app` for the 25 authenticated screens |

**What the workflows did and no command here does.** Said out loud instead of assumed:

- **gitleaks** and **osv-scanner** — secret and vulnerability scanning. They run as one-off commands
  (`gitleaks detect`, `osv-scanner --lockfile package-lock.json`); nothing here installs them.
- **A clean install from the lockfile.** The `quality` job started from `npm ci --ignore-scripts` on a
  fresh checkout, so a broken `package-lock.json` or a dependency that only exists in this machine's
  `node_modules` used to surface there. Locally the gate runs on whatever is installed.
- **Running on the pinned Node.** The job read `.nvmrc`; here nothing checks which Node you are on.
- **Anything running by itself.** Nothing is triggered by a push or a pull request: `lefthook`
  covers the commit (format, lint, tokens, typecheck, related tests) and the rest is typed by hand.

## Structure

```
app/                 routes (App Router). Pages are shells that compose a feature view.
components/ui/       the design-system components (DESIGN.md §7); no data access
components/shell/    AppShell, Sidebar, TabBar, MoreSheet, PageHeader, ConnectionBanner, Avatar
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
tokens/              design tokens; design/preview reads these same files
types/api.d.ts       generated from the backend OpenAPI (endpoints.md sits in the repo root)
design/              the UI: spec/ (one file per screen) and preview/ (what it looks like, npm run design)
tests/e2e            Playwright; unit tests sit next to the code (*.test.ts)
tests/gate           the recorded offline demos of gates O-A and O-B (npm run demo:offline)
tools/               check-tokens, contrast-check, size-limit, gen-api-types, lighthouse,
                     check-dev-routes, e2e-backend, sync-fixtures
```

Dependency direction: `app → features → components/ui | lib`. Never `features/a → features/b`;
shared code moves up to `lib` or `components/ui`. ESLint enforces it.

## Routes

English has no prefix, Spanish lives under `/es/...` (`localePrefix: as-needed`).

Below 900px the tab bar holds Home, Transactions, Add, Budgets and **More**; More opens a sheet with
Accounts, Stats, Categories, Settings and the user (T-72). From 900px up the sidebar lists them all.

| Route                                                          | Screen                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                            | Public landing (server-rendered per request, P-41)                                                                                            |
| `/login`, `/register`, `/onboarding`                           | Access and first-run flow                                                                                                                     |
| `/home`                                                        | Authenticated home                                                                                                                            |
| `/settings`, `/settings/appearance`                            | Settings hub (language, currency, time zone, your data, install, about, delete) and appearance                                                |
| `/settings/profile`, `/settings/sessions`                      | Profile & security (name, email, password with re-authentication) and active sessions                                                         |
| `/settings/sync`                                               | Sync status: cursor, queue size, last error, storage use and grant, display mode, link to the tray, force full resync                         |
| `/sync`                                                        | "Needs your attention": the queued changes the server refused, one card each, and the conflict sheet                                          |
| `/transactions`                                                | Transactions list: filters in the URL, day groups, infinite scroll                                                                            |
| `/transactions/new`, `/transactions/[id]/edit`                 | Transaction form: create (optional quick-add draft in the query string, and `?group=` to record it into a shared group) and edit with delete  |
| `/transactions/[id]`                                           | Transaction detail with edit and delete                                                                                                       |
| `/transactions/review`                                         | Inbox of quick expenses to complete (`?focus=<id>` scrolls to one)                                                                            |
| `/accounts`                                                    | Accounts list: summary, active grid, folded archived section                                                                                  |
| `/accounts/new`, `/accounts/[id]/edit`                         | Account form: create (with opening balance) and edit                                                                                          |
| `/accounts/[id]`                                               | Account detail: hero, make main, archive/restore, its transactions                                                                            |
| `/shared`                                                      | Shared: people and shared groups (`?face=`), what you are owed and what you owe                                                               |
| `/shared/new`                                                  | New shared group: who was in, the default split, and the expenses you already recorded                                                        |
| `/shared/groups/[id]`                                          | A shared group: what still counts as yours, its people with their state, its expenses                                                         |
| `/shared/people/[id]`                                          | A person: the net with them, the groups they are in, the payments made, edit and archive                                                      |
| `/shared/joined/[id]`                                          | A group somebody shared with you: read-only, where you stand with them, and Add to my ledger                                                  |
| `/categories`                                                  | Categories grid by type (`?type=`), usage counts, archived list, restore defaults                                                             |
| `/categories/new`, `/categories/[id]/edit`                     | Category form: create (`?type=`) and edit with locked type and archive                                                                        |
| `/budgets`                                                     | Budgets list for a month (`?reference=YYYY-MM&period=`), global card featured                                                                 |
| `/budgets/[id]`                                                | Budget detail per month: hero, period override, categories, transactions, archive                                                             |
| `/budgets/new`, `/budgets/[id]/edit`                           | Budget form: scope, categories, six period types, amount, color, advanced options                                                             |
| `/budgets/past`                                                | Ended and archived budgets with "Create again"                                                                                                |
| `/stats`                                                       | Monthly stats by category, day or tag (`?reference&type&groupBy`) with drill-down                                                             |
| `/stats/trends`                                                | Six or twelve months ending on the month Stats was showing (`?reference&range`)                                                               |
| `/privacy`, `/terms`                                           | Privacy policy and terms of service (static, legal drafts pending the owner's review)                                                         |
| `/dev/ui`                                                      | Component catalog (development only)                                                                                                          |
| `/dev/pickers`                                                 | Category, account and date pickers against the real API (development only)                                                                    |
| `/dev/frame?w=390&url=…`, `/api/dev/login?email&password&next` | Screenshot helpers (development only)                                                                                                         |
| `/api/auth/*`                                                  | Session BFF (httpOnly cookies)                                                                                                                |
| `/api/[...path]`                                               | Generic proxy to the backend; logs one JSON line per call with the `requestId`                                                                |
| `/monitoring`                                                  | Sentry tunnel (rewrite to the ingest host) so CSP keeps `connect-src 'self'`                                                                  |
| `/api/health`                                                  | Liveness the connectivity heartbeat polls (`lib/network`)                                                                                     |
| `/api/csp-report`                                              | Where the Content-Security-Policy reports land                                                                                                |
| `/theme-init.js`, `/install-init.js`, `/viewport-init.js`      | Head scripts: palette and mode before first paint, the install offer before the app hydrates (F-87), and the fixed scale of the installed app |

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
  `lib/observability/scrub.ts`: no user, bodies, query strings, cookies or long numbers ever leave,
  and neither does what the injected Vercel toolbar throws. A failed request is only reported once
  the heartbeat confirms the network is there, so an offline device files nothing.
- **Add copy:** every user-visible string is a key in `messages/en.json` and `messages/es.json`,
  nested by feature (`transactions.list.empty.title`). Use ICU plurals and rich tags; never
  concatenate fragments. Client code gets only the namespaces its segment lists in
  `MESSAGE_SCOPES` (`lib/i18n/scopes.ts`); `lib/i18n/scopes.test.ts` says what to add or remove.

## Working rules

See `CLAUDE.md` (definition of done, hard rules) and `DECISIONS.md` (why things are the way
they are). Commits follow Conventional Commits with the task reference: `type(scope): subject (T-nn)`.
