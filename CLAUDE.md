# Working rules for this repository

Ledger Flow web client. Next.js (App Router) + React + TypeScript + Tailwind v4. A real
multi-user product: never assume a single user, little data or a trusted client.

This file overrides any default habit. The full specification lives outside the repo in
`../auditoria/front/diseno/HANDOFF.md` (how and what), `DESIGN.md` (UI/UX) and
`../auditoria/front/FASE-2-CONTRATO-FRONTEND.md` (API contract). Progress of the backlog and of the
owner's requests is tracked in `../auditoria/front/PROGRESO.md`; update it when you close an item. Read
them before changing anything.

---

## 1. Definition of done

A change is not done until all of these hold. If one does not apply, say so and why.

1. **`npm run ci` is green**: typecheck, lint, format check, token check, unit and component
   tests, build. Never report "done" without running it.
2. **Tests for what you added**: happy path and edges (empty, invalid, offline, 401/429,
   `INVALID_CURSOR`). A bug fix starts with the failing test.
3. **Verified against the real API** (backend running locally), not only against mocks.
   Mocks are a fallback for cases the backend cannot produce on demand.
4. **Checked against the design**: the screen matches its capture in
   `../auditoria/front/diseno/preview/capturas/` in mobile and desktop, light and dark, and renders
   its four states (data, empty, loading, error).
5. **Docs updated** (§4). `DECISIONS.md` has an entry for every non-obvious choice.
6. **One commit per backlog item** (`W-nn`), in English, describing only what was actually done.

---

## 2. Hard rules

- **English everywhere**: identifiers, files, message keys, commits, docs, decisions. Spanish
  exists only as content inside `messages/es.json`.
- **No comments** unless a single line documents an external constraint the code cannot
  express (browser bug, backend rule, non-obvious decision). No JSDoc decoration, no TODOs
  without a ticket, no commented-out code, no separators. If a comment can be deleted without
  losing a constraint, delete it.
- **No color outside tokens** (`bg-surface`, `text-c-red-text`…). No hex, no Tailwind default
  palette classes. `npm run check-tokens` fails the build.
- **No user-visible text outside `messages/`**. Lint fails on JSX literals.
- **No `fetch` outside `lib/api`**. No `any`. No `!` without a one-line justification.
- **No tokens or personal data in `localStorage`**: session lives in httpOnly cookies set by the
  BFF; per-user caches are partitioned and purged on logout.
- **No money math in the client**: balances, totals and `spent` come from the API; amounts are
  formatted with `Intl`, never parsed from formatted strings.
- **Never duplicate what can be derived**: enums, error codes and DTOs come from
  `types/api.d.ts` (generated from the backend OpenAPI) and from `lib/api/errors.ts`. A
  hardcoded copy is a bug waiting to drift.
- **Never branch on the server's `message`**, only on `code`.
- **Never silence an error.** If something fails it must be visible and the message must be true.
- **Never claim work you did not do** in a commit, a summary or a doc.
- **Do not delete the previous branch or force-push** without the owner's explicit approval.

---

## 3. Code standards (summary; details in HANDOFF §3)

- Architecture by features: `app → features → components/ui | lib`. Never `features/a →
features/b`; shared code moves up.
- Server state only in React Query with the key factories in `features/*/keys.ts`. UI state
  local. Filters and period in the URL. No global store.
- Pages are shells; `features/<x>/components/*View` orchestrate hooks and the four states;
  `components/ui` is presentational and has no data access.
- Forms: React Hook Form + Zod; server errors mapped by `code` to fields via
  `lib/api/errors.ts`; one `Idempotency-Key` per form payload.
- Sheets and modals use `<dialog>` through `components/ui/Sheet`; native `<select>` only for
  date and time.
- Every component ships with an accessible name, keyboard support, `aria-live` where it
  announces, and a Testing Library test.
- Formatting is Prettier's; imports are sorted by lint. Do not hand-format.

---

## 4. Documentation you must update

| You changed                           | Update                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| A route, layout or navigation item    | `README.md` route map                                                                        |
| A feature's behaviour                 | `features/<x>/README.md` (one paragraph, what and why)                                       |
| An architectural or library choice    | `DECISIONS.md` (date, decision, alternatives, consequence)                                   |
| Environment variables                 | `lib/env.ts`, `.env.example`, `README.md`                                                    |
| A message key                         | Both `messages/en.json` and `messages/es.json`                                               |
| Something the backend must change     | `../auditoria/front/BACKEND-DESDE-FRONT.md` (report it; do not change the backend from here) |
| Anything you found and are not fixing | `../auditoria/front/PROGRESO.md` § "Tareas futuras y hallazgos registrados": one `F-nn` row  |

---

## 5. Commits

- `type(scope): imperative description (W-nn)`; body explains why and what broke before.
- One backlog item per commit. Related but independent changes are separate commits.
- `lefthook` runs lint, format, typecheck, token check and related tests before every commit
  and `commitlint` validates the message. Do not bypass hooks (`--no-verify` is forbidden).

---

## 6. Fail loudly

Do not swallow errors. Do not retry forever. Distinguish a network failure from a data
conflict. Prefer aborting to leaving the UI in a state that lies (a saved-looking transaction
that never reached the server must show its pending badge).

---

## 7. Before you say it is done

- Did `npm run ci` pass, including format and token checks?
- Did you exercise the flow against the running backend, not just mocks?
- Does the screen match the design capture in both modes and sizes?
- Are both message files updated? Is `DECISIONS.md` updated?
- Any leftover `console.log`, debug flag, commented code or TODO?
- Does the commit message describe only what you actually did?
- Is every finding you are **not** fixing registered as a row, not just mentioned? (see below)

If you find a problem outside the requested scope, do not fix it silently — and do not merely
mention it either. **Register it**: an `F-nn` row in `../auditoria/front/PROGRESO.md` §
"Tareas futuras y hallazgos registrados", or a row in `BACKEND-DESDE-FRONT.md` if the backend owns
it. This covers bugs, dead code, missing guards, rough edges and ideas alike, whether or not the
owner asked for them. Writing it only in a session summary, a handover note or a gate document does
not count: those are diaries, nobody reads them looking for work, and a finding that lives only
there gets copied forward forever and never done. The row may say "not now"; it may not be absent.
If something in your change is incomplete or doubtful, say so.

---

## Commands

```bash
npm run dev            # Next dev server (backend must be running locally)
npm run ci             # full gate: typecheck, lint, format:check, check-tokens, test, build
npm run test           # vitest + Testing Library
npm run test:e2e       # Playwright against the local backend
npm run check-tokens   # fails on raw colors
npm run gen:api-types  # regenerate types/api.d.ts from the backend /docs
npm run format         # apply Prettier
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
