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

| Variable                    | Scope  | Purpose                                                    |
| --------------------------- | ------ | ---------------------------------------------------------- |
| `API_URL`                   | server | Backend base URL. Only the BFF knows it.                   |
| `NEXT_PUBLIC_APP_URL`       | public | Base URL of this deployment (metadata, sitemap, manifest). |
| `NEXT_PUBLIC_CONTACT_EMAIL` | public | Contact, support and privacy mailbox.                      |
| `NEXT_PUBLIC_APP_VERSION`   | public | Tag or commit SHA shown in Settings › About.               |
| `SENTRY_DSN`                | server | Optional error tracking DSN.                               |

## Scripts

| Script                    | What it does                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`             | Next dev server on port 3001                                                                    |
| `npm run build` / `start` | Production build / server                                                                       |
| `npm run ci`              | Full gate: typecheck, lint, format:check, check-tokens, contrast-check, test, build, size-limit |
| `npm run typecheck`       | `tsc --noEmit`                                                                                  |
| `npm run lint`            | ESLint with zero warnings allowed                                                               |
| `npm run format`          | Prettier (`format:check` verifies)                                                              |
| `npm run check-tokens`    | Fails on hex, raw color functions or Tailwind palette classes                                   |
| `npm run contrast-check`  | WCAG AA over every `tokens/palette.*.css` in light and dark                                     |
| `npm run test`            | Vitest + Testing Library (`test:watch`, `test:coverage`)                                        |
| `npm run test:e2e`        | Playwright smoke tests against the local backend                                                |
| `npm run size-limit`      | Route JS budgets over the production build                                                      |
| `npm run gen:api-types`   | Regenerates `types/api.d.ts` from the backend OpenAPI                                           |
| `npm run gen:feature`     | Scaffolds `features/<name>/{api,keys,hooks,schemas,components}`                                 |

## Structure

```
app/                 routes (App Router). Pages are shells that compose a feature view.
components/ui/       the design-system components (DESIGN.md §7); no data access
components/shell/    AppShell, Sidebar, TabBar, Fab, PageHeader, ConnectionBanner
features/<domain>/   api.ts · keys.ts · hooks.ts · schemas.ts · components/ · README.md
lib/api              HTTP client, ApiError, error taxonomy, idempotency, single-flight refresh
lib/query            QueryClient defaults and persistence
lib/i18n             next-intl config, money and date formatting
lib/theme            palette and mode
lib/icons            curated Lucide map and CategoryIcon
lib/format           money and date windows in the user's timezone
messages/            en.json, es.json (the only place with user-visible text)
tokens/              design tokens, copied from auditoria/diseno/tokens
types/api.d.ts       generated from the backend OpenAPI
tests/e2e            Playwright; unit tests sit next to the code (*.test.ts)
tools/               check-tokens, contrast-check, size-limit, gen-api-types
```

Dependency direction: `app → features → components/ui | lib`. Never `features/a → features/b`;
shared code moves up to `lib` or `components/ui`. ESLint enforces it.

## Routes

| Route | Screen                                           |
| ----- | ------------------------------------------------ |
| `/`   | placeholder until W-04 introduces locale routing |

## How to

- **Add a feature:** `npm run gen:feature`, then fill `api.ts` (one function per endpoint),
  `keys.ts` (query-key factory), `hooks.ts` (React Query), `schemas.ts` (Zod for user input) and
  the view components. Add its message subtree to both `messages/*.json`.
- **Add a palette:** copy `tokens/palette.tinta.css`, change the selector to
  `:root[data-palette="<name>"]` and the 18 seeds, run `npm run contrast-check`, import it in
  `app/globals.css` and register it in `lib/theme/palettes.ts`.
- **Add a language:** add `messages/<locale>.json`, register the locale in `lib/i18n`, map it to a
  format locale, and add the row in Settings › Language.

## Working rules

See `CLAUDE.md` (definition of done, hard rules) and `DECISIONS.md` (why things are the way
they are). Commits follow Conventional Commits with the backlog reference: `type(scope): subject (W-nn)`.
