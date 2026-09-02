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
