# Changelog

All notable changes to Ledger Flow are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow semver.
Production deploys only from a tag.

## [Unreleased]

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
