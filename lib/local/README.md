# `lib/local` — the offline vault

One IndexedDB database per user, `lf-vault-<userId>`. Two users on a device never cross; signing back
in with the same `userId` finds the same vault **and the same outbox**.

Delivered by O-F1 (the store and its migrations), O-F2a (filling it, and reading accounts,
categories, transactions and Home's non-money lists from it while offline) and O-F3 part 1
(deriving balances). `spent` and the day buckets are O-F3 part 2; the outbox is O-F4.

## The hard line: disposable mirror, sacred outbox

|                                                | mirror (`profile`, `accounts`, `categories`, `transactions`, `budgets`) | outbox                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| What it is                                     | a copy of the server, re-downloadable                                   | writes that have not reached the server                 |
| Losing it costs                                | one pull                                                                | the user's data                                         |
| On a version bump                              | cleared and re-pulled                                                   | migrated one operation at a time, or the upgrade blocks |
| On logout                                      | always cleared                                                          | kept unless the caller confirms discarding it           |
| On session expiry / app update / cache cleanup | untouched                                                               | untouched (invariant 7)                                 |

They share one database because **IndexedDB transactions cannot span two databases** and O-F4 has to
write the entity and its operation atomically (plan §4.1). Nothing here ever calls `deleteDatabase`
on a vault, and the mirror reset transaction deliberately excludes the `outbox` store.

## Versions

Three numbers, because the two halves migrate by opposite rules:

- **`VAULT_SCHEMA_VERSION`** — the physical IndexedDB version. Its upgrade only ever _creates_ stores
  and indexes; it never deletes or reshapes one.
- **`MIRROR_VERSION`** — logical, kept in `meta`. Changing it clears every mirror store and drops
  `syncCursor`/`syncedAt`, so the next pull is a full snapshot. `openVault` reports `mirrorReset`.
- **`OUTBOX_VERSION`** — logical, kept in `meta`. Changing it runs `OUTBOX_MIGRATIONS[n]` over every
  queued operation. A migration returning `null` means "cannot be carried forward": then **nothing is
  written**, `openVault` reports `outbox: "blocked"` with `blockedOperations`, and the stored version
  stays put until the queue drains. `migrateOperation` only walks forward, so a queue written by a
  newer build blocks an older one rather than being reinterpreted.

Reconciliation happens on every open, not inside `upgradeneeded`: a `versionchange` transaction
cannot await outside work, and refusing to bump a number in `meta` is a far clearer way to block than
aborting a schema upgrade.

## Record shape

Mirror records are `{ id, row, updatedAt, …index keys }` and `row` is **exactly** what
`GET /sync/changes` sent — `lib/local/derive` (O-F3) is checked against the backend's parity
fixtures, and that comparison only means something if the server's shape arrives untouched.

IndexedDB will not index a boolean or a null, so:

- flags are `0`/`1`: `archived` on accounts/categories/budgets, `deleted` on transactions;
- anything an index must skip is **omitted**, not stored as null: `liveDate` is absent on tombstones,
  `pendingReview` exists only on live rows that need review, and null foreign keys are left out;
- `dateCursor` is the compound `["liveDate", "id"]`. IndexedDB skips a record when any part of a
  compound key path is missing, which is what keeps the transaction list from walking a tombstone;
  the `id` half breaks ties between two transactions on the same date.

Rows are applied by `id` with `put`, so the deliberate 60-second cursor overlap (D-14) costs nothing.

## Filling it: `pull.ts`

`pullChanges(vault)` reads `GET /sync/changes` from the cursor kept in `meta.syncCursor`, page after
page, until `hasMore` is false. No stored cursor means no `since` and no `cursor`, which is the full
snapshot down the same code path.

- Each page is applied in **one transaction** that also writes the new cursor, so a run interrupted
  between pages resumes where it stopped instead of starting over.
- The cursor is stored **verbatim**: it is opaque (`base64url("v1|<updatedAt>|<id>")` today) and the
  client has no business reading it.
- `meta.syncedAt` is written **only by the page that drains the feed**. A half-applied first snapshot
  holds a fraction of the data, and `repository` refuses to answer from a mirror in that state — an
  incomplete copy would read as an empty account.
- A feed that says `hasMore` while handing back the same cursor would page forever; that is
  `SyncFeedStalledError`, not a retry.
- **The row the feed sends is not the last word while the queue still holds writes for it** (D-23,
  F-25). `applyPage` hands each row to `outbox/reconcile.ts`, which puts the server's row down and
  projects back on top of it, in `seq` order, every operation on that row that is still `pending` or
  `sending` — the table is `outbox/reproject.ts`, one rule per route, the mirror image of what each
  write projects when it is queued. Without it a movement deleted with no network comes back alive on
  the next pull, and an edit made offline is reverted by the 60-second overlap of D-14. An operation
  in `conflict` or `failed` is **not** projected back: it will never be sent, so the mirror shows the
  server's version and the user's lives in the conflict sheet. `updatedAt` is never rewritten, so the
  guard the next write reads is still the server's own stamp (invariant 2), and a create has no rule
  at all: a create in the feed is one whose answer was lost, and the server's row is the more current
  of the two.
- **The server's version is kept aside while the row has a queue** (D-24, R-3). Every mirror record
  carries `server?`: the row as the server last sent it, present only while the outbox holds
  operations on that row. `reconcileRow` restates the rule `row = server + what will still be sent`
  in **one place**, and everything that learns something new about a row goes through it: a page of
  the feed, the answer to a write (`routes.ts` `confirm`), the `current` of a `409`, a definitive
  refusal, a discard, a retry. Before R-3 only the pull did this, so what a conflicted row showed
  depended on whether the pull or the drain ran first, and discarding a refused write left the
  refused projection in the mirror with no pull that would ever correct it (its stamp never moved).
  The same walk restates each queued movement's money `effect` from the server's row, so the
  projected balance telescopes from the server's figure; a create still in the queue keeps its own
  `before: null`. An archive or delete confirmed without the row (`{ message }`, F-22; a `404` on a
  removal) moves the baseline the way the operation asked (`reconcileRemoval`). A `MIRROR_VERSION`
  bump introduced the field: the mirror is re-pulled, the outbox is untouched.

Scheduling lives in `mirror.ts`. `startMirror(userId)` opens the vault, calls
`requestPersistentStorage()` and pulls: on open, on regaining focus once the copy is older than
`PULL_STALE_MS`, and when the network comes back. **Never on a background timer** — plan §4.2: a
30-second poll is 2 880 requests a day per device, worse than the traffic local-first exists to
remove. `AppFrame` starts it with the signed-in user and tears it down when that user changes.

A request that arrives while a pull is running joins it and asks for **one more pass** when it ends
(F-32): the pull in flight cannot carry what the server wrote after it started. It is the same
`wanted`/`served` discipline the engine uses for the queue.

## Reading from it: `repository/`

`features/*/api.ts` calls `lib/local/repository` instead of `lib/api/client`; the hooks, the query
keys and the components do not know the difference. `read(fromServer, fromMirror)` is the seam:

- it first waits for the vault the frame said it was about to open (F-31). The screens render, and
  query, before `AppFrame`'s effects run, so a read that decided on the handle alone went to the
  server with a full mirror sitting there; `AppFrame` raises the gate while it renders and
  `startMirror` lowers it with the handle, or with null when none opens;
- while there is network it calls `fromServer` and the online path is exactly what it was (O-F2a).
  `READ_SOURCE` in `repository/read.ts` is the single constant O-F2b flips to make the mirror the
  primary path, once the whole suite passes with it in front;
- with no network it asks the mirror, but only when a pull has finished at least once;
- a mirror reader returns `undefined` for "I cannot answer this" — an id it never saw, for instance —
  and the read falls through to the server, which produces the real network error rather than a
  fabricated one or an empty list that lies.

`repository/budgets.ts` builds the API's view out of the saved shape. The mirror stores `SyncBudget`,
and everything the view adds — `periodKey`, the window, `baseAmount`/`amount`, `hasOverride`,
`expired`, `effectiveFrom` — comes from that row plus the categories mirror, except `spent`, which
needs the transactions and arrived with O-F3 part 2. The list's two post-pagination filters are the
server's: a period that closes on or before the budget's lifetime floor is dropped, and an expired
CUSTOM one-shot leaves the default listing, both **after** the page is counted, so a page's `total`
counts rows its `data` no longer shows. The detail answers for an archived budget; only the list
leaves it out.

`repository/stats.ts` is the single seam for `/stats/spending`. All six of its call sites in
`features/*/api.ts` go through `readSpending` — `home.fetchSpending`, `budgets.fetchSpendingTotal`,
`stats.fetchStats`, `transactions.fetchDailyStats`, `categories.fetchCategoryUsage` and
`categories.fetchCategoryCounts` — so a screen's buckets come from one derivation rather than six.
It stamps the defaults `StatsController` stamps on an absent parameter: `groupBy` is `category` and
`type` is **EXPENSE**, which is not the service's "everything but ADJUSTMENT" — no URL can ask for
that one, only a fixture can.

`lib/query/domains.ts` lists the domains whose **list and detail** reads answer locally, and its
prefix covers every key of a domain. All six are in it: `budgets`, `home` and `stats` joined when
O-F3 part 2 derived `spent` and the buckets, which were the last server-only reads any of them had,
and with them went the last two that were paying the cost knowingly — `categoryKeys.usage`/`counts`
and `transactionKeys.daily`, `/stats/spending` reads inside already-listed domains that failed once,
quietly, while offline. A domain added with a read the mirror cannot answer has to stay out of the
list, because unpausing it turns a paused skeleton into a failed request.

`mirrorPage` rebuilds the `data` + `pagination` envelope the list endpoints return. It can page on
the last `id` because the API sorts these lists by `_id` ascending, which is IndexedDB's own key
order. React Query pauses fetches while offline, so `lib/query/client.ts` gives the mirror-backed
domains `networkMode: "offlineFirst"`: a paused query never reaches its `queryFn` and the mirror
would never be asked.

Transactions are the one list the API does not sort by `_id`, so `repository/transactions.ts` builds
its own envelope:

- it walks the `dateCursor` index backwards, which is the API's `date DESC, _id DESC` and, because a
  tombstone has no `liveDate`, cannot reach a deleted row at all;
- `from`/`to` bracket that walk (`[from]` inclusive to `[to]` exclusive — an array key `[d, id]`
  sorts after `[d]`, so the open upper bound is the server's `$lt`). Every other filter is applied
  while walking, because inventing an index for each combination is how a local list starts
  disagreeing with the API;
- the cursor is the id of the last row served, exactly as the API hands it back. The pivot's date is
  read from the row it names — a tombstone still carries one — so the keyset survives rows arriving
  above the page already served, and deleting the last row of a page does not restart the list;
- a query carrying a parameter the mirror does not apply is declined rather than answered, which is
  the same `undefined` contract as an id it never saw.

## Deriving money: `derive/`

Pure functions: they take arrays and return figures, and none of them opens IndexedDB. That is what
lets the frontend feed them the very rows the backend checked against a real mongod, so the two
sides cannot drift into disagreeing about the same money.

- **Every figure is added in minor units** — multiply by 100, round, add integers, divide once at
  the end. `1000 − 10.10 + 1500 − 7.77 − 100 − 3.45` as a running float is `2378.6800000000003`.
- `deriveBalances` is `openingBalance` plus the effect of the live rows: an EXPENSE leaves its
  `from`, an INCOME reaches its `to`, and a TRANSFER and an ADJUSTMENT move both. A deleted row
  (`deletedAt`) leaves every figure; an archived one does not, and an archived account still gets a
  balance. A row naming an account the mirror never saw is skipped rather than inventing one.
  **It is the parity oracle, not the screen's recipe** (decision of 2026-09-04): what Accounts will
  show once the outbox exists is the server's `balance` from the mirror plus the effect of the unsent
  operations — a walk over the outbox, not over the whole history — and a test in O-F4 must prove the
  two agree whenever the outbox is empty.
- The pending tray is **not** a second derivation: `repository/transactions.ts` already answers it
  (`pendingDetails=true&includeSummary=true`, count in `total`, sum in `summary`), so the parity test
  feeds the fixture rows into a test vault and reads the tray through the repository.
- `sumAmounts` is the one adder. `repository/transactions.ts` answers `includeSummary` with it, so
  no arithmetic is left in the repository — that figure is the endpoint's own sum, not a projection.
- `resolvePeriod` is the budget window: the same rules as the server's `shared/budgetPeriod.ts`,
  including the BIWEEKLY grid anchored on the Monday of 2024-01-01 and the key that never carries a
  dot because it is also a `$set` path in `amountOverrides`.
- `deriveSpending` and `deriveBudgetView` restate the aggregation rules rather than assume the rows
  were pre-filtered: **derive owns the rule, the repository owns which rows it sees.** Windows are
  half-open `[from, to)` built in the user's zone, and a day bucket is the local calendar day, so a
  March window in Madrid opens at +01:00 and closes at +02:00 and a November one in New York is 721
  hours long. `repository/window.ts` picks those rows with the `dateCursor` index — never
  `getAll` (D-18) — and normalises a bound to the feed's UTC shape first, because the index compares
  the stamps as strings and a bound carrying an offset would sort below its own last day's rows.

**A balance from here is a projection, never a figure the server sent.** Invariant 2 of the plan
forbids painting one as if it were, so nothing renders these yet: the marking (the amber tone
already designed) arrives with the outbox in O-F4/O-F5a.

`fixtures/` is the backend's committed `lag-money-manager/fixtures/offline/` copied verbatim by
`npm run fixtures:sync` (CI checks out this repo alone, so the copy has to travel with it).
`parity.test.ts` compares the two byte for byte wherever both repos sit side by side and fails on
drift; in CI it skips, saying so in its name. The backend's own CI fails when its generator and its
committed files disagree, so the chain generator → backend files → this copy has a guard at each link.

## Writing to it: `outbox/`

The mirror image of `repository/`. `features/*/api.ts` re-exports its writes, so a screen still
calls `createTransaction` and does not know the difference. Every write does the same three things:

1. **One transaction.** `queueWrite` opens `[...mirror stores, outbox, meta]` at once, lets the
   entity's `project` put the row it should show, takes the next `seq` from `meta.outboxSeq`, and
   puts the operation. Any failure aborts the lot — explicitly, because an IndexedDB transaction
   left open commits by itself and the mirror would keep a row with no operation behind it.
2. **The envelope.** `seq` is the **only** ordering criterion (§2.8 / D-6); `occurredAt` is the
   device's clock and is never used to decide what the server sees first. `baseUpdatedAt` is the
   mirror's `updatedAt`, and only when the server has already seen the row — a row still waiting for
   its own create carries a stamp the server never printed, and guarding with it would be a 409 on
   every attempt. `dependsOn` names the **other** rows the server has not seen (the account a
   movement was created against); same-entity order is `seq`'s job.
3. **The projection answers the screen.** The row is in the mirror, so the UI responds the same with
   and without network. `write()` then asks the engine to drain and reads its own operation out of
   the report: a success hands the screen the server's row, a definitive refusal is thrown at the
   form, and anything else — queued, folded, in conflict, held — is answered from the projection.
   With network the call therefore lasts the whole pass, the pull that follows the push included; the
   pull swallows its own errors, so it never turns a saved write into an error.

A create carries its own id and therefore no `Idempotency-Key` (O-B1). In the two forms that had a
keyring, the key **is** the id now, so a retried submit still names one row. `PATCH
/transactions/batch` no longer goes out as itself: `batchUpdateTransactions` queues the lot expanded
into one `transaction:update` per row, so each row keeps its own guard and its own outcome (F-20).
`POST /categories/restore-defaults` stays a plain call — the server mints those ids, so there is
nothing the mirror can project.

**What a request looks like lives in `routes.ts`, once.** The engine replays operations it did not
queue — after a reload the closures that made them are gone — so every route rebuilds its request
from the envelope's `entityId`, `payload.body` and `payload.query`, and both callers go through the
same table. That is why the body is stored verbatim instead of being re-derived from the mirror.

The client never writes `updatedAt`, `currency`, `source` or `balance` on a row the server already
has (invariant 2). A row created offline has to show them anyway; they come from the profile the
mirror holds, and the next pull replaces the row. Budgets are the one confirmation that merges
instead of replacing: the API answers with the **view**, which drops the override map, the CUSTOM
dates and the owner.

**The balance projection.** `projectBalances` is the server's `balance` from the mirror plus the
effect of the queued operations, which is why each money operation records what it replaced and what
it left. It borrows the movement rule from `deriveBalances` rather than restating it, so the oracle
and the screen agree by construction: with an empty queue the projection is the mirror's own figure,
and with a queue it equals `deriveBalances` over the optimistic rows. `repository/accounts.ts`
applies it, so Accounts is the first screen to paint a projected figure.

**Marking (invariant 2, F-16).** `outboxStatusStore` says how much is queued, how much needs a
decision, which rows those are, and which families of figures the queue can move; `useOutbox()`
reads it and `components/ui/Projected` puts the amber `cloud-off` mark next to the figure
(DESIGN §8.12). Balances, `spent` and its progress bars, Home's month and day bars, the Statistics
total and its bars, and Movements' period summary carry it. A movement whose own write is still
queued also says so on its row: the amber "Pending sync" badge and the "saved on this device" meta,
turning to a red "Needs attention" once the server refused that write.

## Draining it: the engine

`engine.ts` is the only thing that talks to the server on the queue's behalf, and `requestSync()` is
the only way in.

- **Single flight.** One drain runs at a time; every trigger that arrives while it runs joins it. A
  request that lands _after_ the running pass took its last look at the queue is not lost — the pass
  records which request it served, and a later one asks for a pass of its own.
- **Order is `seq` and only `seq`.** Nothing is reordered and nothing is dropped for taking too long
  (invariant 7). A network failure, a 5xx, a 429 or a 401 ends the pass where it stands and the rest
  of the queue keeps its place.
- **Coalescing, before anything is sent** (`coalesce.ts`). Ten edits of one row become one request;
  a movement created and deleted with no network becomes none at all, and its row leaves the mirror
  too. Two rules make it safe: it never folds **across an operation the server has already been
  asked about** (dispatched, sending or in conflict), and the `effect.before` that survives is the
  **first** one's — the mirror stopped holding the server's row at the first write, so keeping the
  second would count that move twice. Archiving is not a removal: an archived account is still the
  user's row, so `create` + `archive` still reaches the server. A fold never moves an operation
  ahead of a create it names in `dependsOn`: that edit starts a run of its own and keeps its place.
- **Chained guards are rebased.** Every operation queued on one row reads the guard the mirror held
  when it was queued, and the client never writes `updatedAt`, so an edit followed by a delete (or an
  archive followed by a restore) both carry the stamp the first one is about to replace. When the
  first lands and answers a row, the operations of that row that still share its guard move to the
  new stamp, inside the transaction that settles it. A guard that a pull moved in the meantime is
  another device's edit: it is left alone and earns its 409. An archive answers `{ message }` today,
  so a restore queued behind it cannot be rebased until the backend answers the row (F-22).
- **Backoff.** 1 s doubling to 60 s, with equal jitter that can only shorten the step, and never
  shorter than a 429's `Retry-After`. It is the only timer the engine owns: there is no periodic
  push and no periodic pull (§4.2).
- **`dependsOn`.** An operation never goes out before the create it names, and when an operation
  ends in conflict or is refused for good, only what named that row waits with it; the rest of the
  queue goes out.
- **Triggers.** Back online, app open, regaining focus, and Background Sync where it exists —
  `startSyncEngine` registers the tag and listens for the worker's message, which `app/sw.ts` posts
  to its clients when the browser wakes it with that tag (F-24). After a round the server **answered**
  — a write that landed, a `409`, a refusal for good — a pull (`afterRound`, §4.2), wired by
  `startMirror`. A network failure or a 5xx says nothing new about the data and pulls nothing.
- **`409 ID_TAKEN` re-mints** (F-21). O-B1 with D-17 leaves that code for an id another user owns,
  so the row takes a fresh one — in the mirror, in the rows that named it, and in the queued
  operations that named it — and goes back in line **once**. A second collision on a fresh UUID v7
  is a bug, not luck.
- **A refusal the queue cannot undo.** The rollback a write registers lives in memory, so an
  operation that outlived its tab has none: it stays queued as `failed` rather than vanishing, and
  the tray that shows it is O-F5a. The same goes for a fold with only some of its rollbacks left:
  undoing half of it would leave the mirror at an edit the server never got, so the whole run stays.
- **A `409 STALE_UPDATE`** is either merged by the engine or handed to the user; see below.

## Resolving what the queue cannot: `conflict.ts` and `resolve.ts`

A `409 STALE_UPDATE` means the row moved under the operation's guard. What happens next is decided
in the front, in one place, because the server does not need to know which fields are text (§6
O-F5a):

- **`conflict.ts` classifies the operation, not the diff.** An **edit** whose body carries only
  `description`, `note`, `tags`, `name`, `color`, `icon` or `pendingDetails` is `"text"`; anything
  else — money, a category, a date, a create, a removal, making an account the default — is
  `"structural"`. `pendingDetails` is the review flag the PUT behind every quick capture carries,
  neither money nor a reference (R-3).
- **Text merges itself.** The engine rewrites the guard to the stamp the 409 answered with and puts
  the operation back in line, without a word to the user. The API's `PUT` is a partial update, so
  the other device's other fields survive; the two edits both land. It gives up after
  `AUTO_MERGE_ATTEMPTS`, and never retries against a stamp that did not move — that would only
  conflict again.
- **Money and structure ask.** The operation becomes `conflict`, and the row the server answered
  with rides along in the envelope's `serverRow`. That is why the sheet needs no second request, and
  why it can show a version the mirror no longer holds: the mirror holds **this device's**
  projection.
- **The sheet resolves it two ways** (`resolve.ts`). `discardOperation` settles the operation
  without ever sending it and reconciles the row: the server's version the mirror kept aside (or the
  409's `current`, for a row that has none) plus whatever the queue still holds for it — the server
  never received the write, so no pull would correct it. Discarding a **create** takes with it
  everything that named that row in `dependsOn`, transitively, and the row itself: it will never
  exist on the server. `retryOperation` puts the operation back as `pending` with the server's stamp
  as its guard and `attempts` at zero, reconciles the row so the user's version shows again, then
  asks for a drain. Both act only on operations still `conflict` or `failed`: one another tab has
  already put back in line is no longer the user's to discard.
- **Each queued operation earns its own decision.** Resolving one does not rebase the guards of the
  others on that row: D-22 only rebases what an answer from the server has just proved, and a choice
  about one field is not a choice about the next one. The common case costs nothing, because a
  text-only follow-up merges itself.

- **Both ways out are also batch.** `discardOperations` and `retryOperations` take a list of `seq`
  and do the whole thing in one transaction and one drain; the single-operation calls are those with
  a list of one. `discardImpact` answers the question the tray has to ask **before** deleting
  anything: how many operations a discard would take with it, cascade included.

Where they are resolved:

- `ConnectionBanner`'s red stripe counts conflicts **and** definitive refusals (F-23). "Review"
  opens the first of them in queue order; "See all" goes to the tray.
- **The tray, `/sync` — "Needs your attention"** (`app/[locale]/(app)/sync`). Every stuck operation
  in `seq` order, each with its reason in plain language and the same two ways out, plus "Discard
  all" and "Try all again". It has a route of its own rather than a place in Settings because
  Ajustes › Sync status is O-F6's, and the stripe has to be able to reach this list today. Nothing
  here blocks the rest of the queue: only what named a stuck row waits with it.
- **The movement's own detail screen** (F-29). `outboxStatus.attentionRows` maps a row id to the
  `seq` of the first stuck operation on it, so the screen showing a movement can open the sheet for
  it. The list row cannot: it is a `RowButton`, and a button inside a button is not HTML.

## Persistence

`startMirror` calls `requestPersistentStorage()` once, before the first pull writes anything.
It asks for `navigator.storage.persist()` and reports
`storage.estimate()`. Without the grant the browser may evict IndexedDB under storage pressure — that
is months of offline records. Safari grants it reliably only to an installed PWA, which is why D-12
makes the installed app the supported mode. `readStorageDurability()` reads the state without asking.
Both answer honestly when the API is missing rather than assuming it is there.

## Purging

Purging is **never automatic**. `purgeVault(userId, { discardPendingWork })` clears the mirror every
time — on a shared device the next user must not see the previous one's data — and keeps unsent
operations unless the caller confirms discarding them, reporting `operationsKept` /
`operationsDiscarded` either way. `lib/query/purge.ts` keeps the disposable React Query caches
(`lf-cache-*`) and never matches the vault prefix.

`SessionProvider` calls `purgeVault` on an explicit logout with the safe default and warns when it
keeps a queue. **The confirmation that would pass `discardPendingWork: true` is O-F5a/O-F6 and does
not exist yet**, so today unsent work always survives a logout.

## Tests

`parity.test.ts` runs the four fixture scenarios (`cop-bogota`, `eur-madrid`, `jpy-tokyo`,
`usd-new-york`): `deriveBalances` straight against `expected.balances`, and the pending tray
through the repository over a test vault against `expected.pending`. Everything else `npm run test`
covers against a real IndexedDB
(`fake-indexeddb`, wired in `vitest.setup.ts`): the stores and every index key, both migration policies with 20 queued operations
inside, the blocked path, the purge rules, the multi-page pull with its overlap and its stalled feed,
the four rules of the read seam, accounts, categories, transactions and Home's lists answering the
same thing online and offline, and budgets declining rather than answering without `spent`. For the
outbox: the counter across a reopen, the envelope, both halves of the atomic write (a projection
that throws and a queue put the store refuses), `dependsOn`, every branch of `write()`, and the
balance projection against the oracle on all four fixtures and over the optimistic rows. Use `openTestVault` from `lib/testing/vault` — it
tracks handles so one failed assertion does not leave a connection open and stall the next test.
