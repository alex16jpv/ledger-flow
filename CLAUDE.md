# Working rules for this repository

Ledger Flow web client. Next.js (App Router) + React + TypeScript + Tailwind v4. A real
multi-user product: never assume a single user, little data or a trusted client.

This file overrides any default habit. **The UI lives in `design/`**: `design/spec/` is the
specification — one file per screen — and `design/preview/` is what it looks like (`npm run design`).
Nothing reaches a screen that is not drawn there first. The API contract is `types/api.d.ts` and
`lib/api/errors.ts`, both generated from the backend's OpenAPI (`npm run gen:api-types`) — never a
hand-written copy. The task list belongs to the owner and is kept outside this repository: work from
what he gives you, and ask him if you have none. Read `DECISIONS.md` before changing anything.

---

## 1. Definition of done

A change is not done until all of these hold. If one does not apply, say so and why.

1. **`npm run ci` is green**: typecheck, lint, format check, token check, contrast check, unit
   and component tests, build. Never report "done" without running it.
2. **Tests for what you added**: happy path and edges (empty, invalid, offline, 401/429,
   `INVALID_CURSOR`). A bug fix starts with the failing test.
3. **Verified against the real API** (backend running locally), not only against mocks.
   Mocks are a fallback for cases the backend cannot produce on demand.
4. **Checked against the design**: the screen matches its plate in `design/preview/`
   (`npm run design`, or `npm run design:shoot` for a capture) in mobile and desktop, light and dark,
   and renders its four states (data, empty, loading, error).
5. **Docs updated** (§4). `DECISIONS.md` has an entry for every non-obvious choice.
6. **One commit per item of the owner's list** (`T-nn`, or `H-nn` for a finding), in English,
   describing only what was actually done.
7. **Reviewed by an independent reviewer** (§8): a fresh subagent that gets the task and what you
   produced, not your reasoning, and says whether this was the best way. Fix what it points out in
   the same branch, or report it as a finding, before closing.

---

## 2. Hard rules

- **English everywhere**: identifiers, files, message keys, commits, docs, decisions. Spanish
  exists only as content inside `messages/es.json`.
- **No comments, by default.** Write one only when it is strictly necessary, and then it is
  **one physical line** documenting a constraint the code cannot express (a browser bug, a rule
  the backend imposes). Never wrapped over two lines, never a paragraph, and never the why of a
  decision — that goes to `DECISIONS.md`. No JSDoc decoration, no TODOs, no commented-out code,
  no separators. If a comment can be deleted without losing a constraint, delete it.
- **No color outside tokens** (`bg-surface`, `text-c-red-text`…). No hex, no Tailwind default
  palette classes. `npm run check-tokens` fails the build.
- **No user-visible text outside `messages/`**. Lint fails on JSX literals.
- **No `fetch` outside `lib/api`**. No `any`. No `!` without a one-line justification.
- **No tokens or personal data in `localStorage`**: session lives in httpOnly cookies set by the
  BFF; per-user caches are partitioned and purged on logout.
- **No money math in the client, with one declared exception**: balances, totals and `spent` come
  from the API. The exception is `lib/local/derive`, which projects them offline (plan D-5): pure
  functions, added in minor units, checked against the backend's parity fixtures (vendored in `lib/local/derive/fixtures/`, refreshed with `npm run fixtures:sync`), and whatever
  paints a projection marks it as one — never as a figure the server sent (invariant 2). Amounts are
  formatted with `Intl`, never parsed from formatted strings.
- **Never duplicate what can be derived**: enums, error codes and DTOs come from
  `types/api.d.ts` (generated from the backend OpenAPI) and from `lib/api/errors.ts`. A
  hardcoded copy is a bug waiting to drift.
- **Never branch on the server's `message`**, only on `code`.
- **Never silence an error.** If something fails it must be visible and the message must be true.
- **Never claim work you did not do** in a commit, a summary or a doc.
- **Never `git push` and never deploy.** The owner pushes and opens every pull request; say
  which branch the work is on and stop there. Reading the remote (`fetch`, `pull`) is free.
- **Do not delete the previous branch or force-push** without the owner's explicit approval.

---

## 3. Code standards

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

| You changed                           | Update                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A route, layout or navigation item    | `README.md` route map                                                                           |
| A feature's behaviour                 | `features/<x>/README.md` (one paragraph, what and why)                                          |
| An architectural or library choice    | `DECISIONS.md` (date, decision, alternatives, consequence)                                      |
| Environment variables                 | `lib/env.ts`, `.env.example`, `README.md`                                                       |
| A message key                         | Both `messages/en.json` and `messages/es.json`                                                  |
| A screen's UI                         | `design/spec/screens/<screen>.md` and its plate in `design/build.mjs` — before touching the app |
| Something the backend must change     | Report it to the owner. Never change the backend from this repository                           |
| Anything you found and are not fixing | Report it to the owner as a finding (§7). Never fix it silently, never only mention it          |

---

## 5. Commits

- `type(scope): imperative description (T-nn)`; body explains why and what broke before.
  `commitlint` rejects a message with no reference.
- One item per commit. Related but independent changes are separate commits.
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
- Did an independent reviewer see the task and the result, and did you act on what it said (§8)?
- Is every finding you are **not** fixing registered as a row, not just mentioned? (see below)

**If you break it, you fix it — now.** A defect you cause along the way, and a broken thing you find
that stands between you and what you have to do, are both fixed in the same branch, and the commit
says so. A finding is not a place to park what is blocking you. What follows is for what lies outside
your work and does not affect it.

If you find a problem outside the requested scope, do not fix it silently — and do not merely
mention it either. **Report it to the owner as a finding**, so it lands in the project's task list:
what it is, where, and what it would take. This covers bugs, dead code, missing guards, rough edges
and ideas alike, whether or not he asked for them, and it covers what the backend owns as much as
what this repository owns. Writing it only in a session summary or a handover note does not count:
those are diaries, nobody reads them looking for work, and a finding that lives only there gets
copied forward forever and never done. The finding may say "not now"; it may not be absent.
If something in your change is incomplete or doubtful, say so.

---

## 8. House rules

The thirty rules the whole product is held to, and three about how the work is done. The sections
above are their detail; the _Enforced by_ note says what checks each one today, and _manual_ means
nothing does yet.

**Money**

1. Money is integers and only moves in one atomic operation inside a transaction. Never decimals,
   never read a balance to write it back. _Enforced by: parity fixtures (`parity.test.ts`); the backend's own tests._
2. Nothing is deleted: it is archived or flagged, and every normal read filters it out. _Enforced
   by: backend reads; manual here._
3. Repeating a request never repeats its effect: client-minted ids, `Idempotency-Key`, stored `POST
/sync` results. _Enforced by: `idempotency.test.ts`, outbox tests._
4. The same figure comes out identical on the server and offline, and the client never computes
   money except the offline projection, which is always marked as such (§2). _Enforced by:
   `parity.test.ts`; marking every projection with `Projected` is manual._
5. Dates are judged in the user's time zone and every transaction freezes its accounting day.
   _Enforced by: parity fixtures per time zone; manual._
6. Offline never lies: the local copy is disposable, what was written without network is sacred, and
   the mirror never invents a figure nobody computed (`lib/local/README.md`). _Enforced by:
   `lib/local` tests against IndexedDB._

**Each user sees only their own**

7. Every query carries the user, and someone else's resource answers like a missing one: 404.
   _Enforced by: backend tests; manual here._
8. Only what is declared gets in: every route validates with its schema and drops the rest; what the
   server derives is never accepted from the client. _Enforced by: backend `validate`; BFF proxy
   tests._
9. The session lives in httpOnly cookies and the browser never sees a token or the backend URL;
   `localStorage` holds preferences only (§2). _Enforced by: `server-only` imports, cookie tests;
   new `localStorage` keys are manual._
10. Secrets never appear in logs, in Sentry or in the repository. _Enforced by: `scrub.test.ts`;
    gitleaks in CI._
11. Configuration is read once and validated at startup; a missing variable stops the process.
    _Enforced by: `lib/env.ts`._

**Everything in its place**

12. Layers are respected and dependencies point inward: `app → features → components/ui | lib`, no
    feature imports another (§3). _Enforced by: ESLint `boundaries/dependencies`._
13. One source for each truth: constants live once, API types and error codes are generated from the
    backend OpenAPI, parity fixtures are generated. Nothing is copied by hand (§2). _Enforced by: CI
    regenerates `types/api.d.ts` and fails on drift; `contract.test.ts`._
14. Do it the way it is already done: one HTTP client, one query-key factory per domain, one error
    presenter, one pagination helper. A new module has the same shape as the others (§3). _Enforced
    by: manual._

**Code that reads itself**

15. No comments by default; when strictly necessary, one line stating a constraint the code cannot.
    The why goes to `DECISIONS.md` (§2). _Enforced by: manual._
16. Names that say their role, automatic formatting, named numbers and nothing dead: no `TODO`, no
    commented-out code, no export nobody imports, no flag nobody reads. _Enforced by: Prettier,
    `simple-import-sort`, `noUnusedLocals`; unused exports are manual._
17. Strict types with no escapes: no `any`, no `!`, every assertion justified (§2). _Enforced by:
    ESLint `no-explicit-any`, `no-non-null-assertion`; strict `tsc`._

**Failures are visible**

18. Never swallow an error and never let a message lie. A network failure is not a data conflict;
    the screen never shows as saved what never arrived (§6). _Enforced by: `shouldRetryQuery` and
    outbox tests; manual._
19. Every error carries a stable `code` and the client branches on it, never on the text (§2).
    _Enforced by: `contract.test.ts` for the codes; branching is manual._

**Tests that test**

20. Every change brings tests for the happy path and the edges, and a fix starts with the failing
    test (§1). _Enforced by: manual._
21. What mocks cannot see is tested for real: the front against the real backend, the backend
    against a real Mongo (§1). _Enforced by: the `e2e` job in CI._
22. Tests are deterministic and order-independent, and coverage has a threshold that someone runs.
    _Enforced by: vitest shuffle; `.only` fails in CI; the coverage threshold exists but nothing runs
    it: manual._

**Cheap to keep running**

23. Code is written with cost in mind, not only indexed: every query asks only for what will be
    used, has its index, and is measured with realistic data. If it can be made faster without
    hurting the code or the result, do it. _Enforced by: manual (measure)._
24. The free tier is protected by design: few connections, lean responses, one request per datum, no
    repeated requests and no timers that wake the cloud for nothing. _Enforced by: manual;
    `tests/gate` counts requests._
25. The front respects its size and Lighthouse budgets, and nothing heavy loads without need.
    _Enforced by: `size-limit` in the gate; the `lighthouse` job._

**The screen is the design**

26. Nothing reaches a screen before it is in the design, and the spec stays as alive as the code
    (§1). _Enforced by: manual: compare with the plate._
27. Every color through a token with AA contrast, every text through `messages/` in both languages,
    every control with an accessible name and keyboard, on mobile and desktop, light and dark (§2,
    §3). _Enforced by: `check-tokens`, `contrast-check`, `messages.test.ts`, the i18n lint rules,
    axe in e2e._
28. Every view has its four states: data, empty, loading and error, with the failure's reference
    (§3). _Enforced by: screen tests; manual._

**It can be followed and maintained**

29. A failure can be followed end to end: one log line per request, an `x-request-id` that travels
    from the browser to the backend and to Sentry, and nothing noisy or personal in what leaves.
    _Enforced by: request-id and `scrub` tests; the log line is manual._
30. Documentation says what the code does today, every non-obvious decision is written down, a
    reversed decision is marked in the original, and a document that is no longer true is retired
    (§4). _Enforced by: manual._

**The rules about the rules**

- Every rule has something that enforces it. A rule whose _Enforced by_ says manual is checked by
  the independent review below, and saying so here is the minimum. _Enforced by: this list._
- A change is not done until §1 holds: gate green and read, verified against the real thing, one
  commit per item, no known defect kept quiet. What is found, not fixed and not in the way is reported to the owner
  as a finding (§7), who numbers it in his list. _Enforced by: the gate, `commitlint`, `lefthook`._
- Every finished change is reviewed by an independent reviewer before it is closed: a fresh subagent
  when an agent did the work, another person when a human did. The reviewer gets the task and what
  was produced (the diff, the gate output, the real verification, the docs), not the reasoning of
  whoever did it, and answers whether it was done the best way and what they would change. Fixes
  land in the same branch before the commit is handed over (amend, or one more commit if the first
  was already reported); what is not fixed is reported as a finding. _Enforced by: manual._

---

## Commands

```bash
npm run dev            # Next dev server (backend must be running locally)
npm run ci             # full gate: typecheck, lint, format:check, check-tokens, contrast-check, test, build
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
