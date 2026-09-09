# Changelog

All notable changes to Ledger Flow are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow semver.
Production deploys only from a tag.

## [Unreleased]

The offline phase: the app opens, reads and records with no network, and sends what it recorded when
the network comes back. 70 commits since 0.1.0.

### Added

- **A local copy of your data** (the "vault", one IndexedDB database per user). Every screen reads
  from it once a first sync has drained, so accounts, movements, budgets, stats and Home answer with
  or without a connection. Balances, `spent` and the charts are derived locally with the same
  arithmetic the server uses, checked against its own fixtures.
- **Writing with no network.** Everything you record goes into a queue and shows on screen straight
  away, marked as not yet sent. The queue survives closing the app, drains in one `POST /sync` batch
  when the connection returns, and never sends the same thing twice.
- **A stripe that says what is going on**, with six states: offline, changes waiting, back online
  (with what it just sent), changes that need you, signed out, and a queue an app update left behind.
- **"Needs your attention"** (`/sync`): the changes the server would not take, each with its reason
  in plain language and a way out — keep this device's version, use the server's, restore an archived
  account, restore under another name, or fix a date the server refused.
- **The app itself works offline**: the service worker keeps the 25 screens, so a route you never
  opened still answers, and Settings › Sync status says what this device holds and what it still owes
  — including whether it is ready to run with no network at all.
- **Local mode**: with a copy on the device, a session that ends no longer locks you out. The app
  keeps working and says how to sign in again to send what is waiting.
- **The app's own calendar and clock**, which follow the tokens and the language and grey out the
  dates the server refuses, in Add, in the filters and in a budget's dates.
- Account type chosen from one row that explains the nine types; the language chosen before the
  account exists; and the pace mark on every progress bar now says what it marks.

### Changed

- Reads come from the local copy first and the server only where the copy cannot answer.
- Signing out, changing language, currency, time zone or profile, deleting the account and restoring
  the default categories need a connection, and say so instead of failing.
- Every figure that includes something not yet sent is marked as a projection, never as a figure the
  server sent.

### Fixed

- The whole end-to-end suite is green for the first time: three long-standing intermittents, each
  with its own cause (F-45, F-11), and the landing's footer link on mobile (F-37).
- No page load reports a blocked `eval` any more: it was Zod's JIT probe (F-67), so the
  Content-Security-Policy is now enforced instead of only reported (F-71).
- The size budget watches the authenticated app, which it had never matched (F-10), and Lighthouse
  no longer leaves a browser profile in the repository (F-12).
- "Needs your attention" asks for a session like every other screen of the app, and is no longer the
  one that opened without one (F-75).
- The development-only screens are proved gone from a production build, not assumed: `/dev/pickers`
  was answering 200 with the not-found page inside it (W-39).
- Nothing moves when the system asks for less motion, and the loading ring closes instead of standing
  still as a broken arc (W-38, F-74).

### Security

- The Content-Security-Policy is enforced, not only reported (F-71), and every development route
  answers 404 in production before it renders anything (W-39).

## [0.1.0] - 2026-09-02

First release of the redesigned front (branch `redesign/fase-2`, phases F1–F5).

### Added

- Access flow: login, register with consent, onboarding, session BFF with `__Host-` cookies,
  refresh and logout-all.
- Home with month summary, quick add, recent transactions and the review inbox for quick expenses.
- Transactions: list with URL filters and infinite scroll, detail, create/edit/delete, transfers.
- Accounts: list with summary, detail hero, make main, adjust balance, archive/restore with rename.
- Categories: grid by type, usage counts, archive/restore, restore defaults.
- Budgets: monthly list with global card, detail per month with period override, six period
  types, past and archived budgets with restore and "Create again".
- Stats by category, day or tag with drill-down.
- Settings: language, currency, time zone, appearance (Brisa and Tinta palettes, light/dark),
  profile and security, active sessions, your data, install, about, delete account.
- Public landing, privacy policy and terms (English and Spanish), technical SEO (canonical,
  `hreflang`, Open Graph image, sitemap, robots, JSON-LD) and a real 404.
- PWA: manifest, maskable icons, Serwist service worker with update prompt, install hint.
- Observability: request ids end to end, anonymized Sentry reporting behind `lib/observability`,
  Vercel Analytics and Speed Insights, structured BFF request logs.
- Quality gates: typecheck, lint, tests, token and contrast checks, size budgets, Playwright e2e
  with axe, Lighthouse CI thresholds, gitleaks and osv-scanner.

[Unreleased]: https://github.com/alex16jpv/ledger-flow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alex16jpv/ledger-flow/releases/tag/v0.1.0
