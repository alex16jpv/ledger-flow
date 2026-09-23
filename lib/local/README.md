# `lib/local` — the offline vault

One IndexedDB database per user, `lf-vault-<userId>`. Two users on a device never cross; signing back
in with the same `userId` finds the same vault **and the same outbox**.

Delivered by O-F1 (the store and its migrations), O-F2a (filling it, and reading accounts,
categories, transactions and Home's non-money lists from it while offline) and O-F3 part 1
(deriving balances). `spent` and the day buckets are O-F3 part 2; the outbox is O-F4. **Since O-F2b
the mirror is the path every read takes**, network or not; the server answers a read only where the
mirror says it cannot.

## The hard line: disposable mirror, sacred outbox

|                                                | mirror (`profile`, `accounts`, `categories`, `transactions`, `budgets`, `contacts`, `sharedGroups`, `sharedExpenses`, `settlements`, `invitationsSent`, `invitationsReceived`, `joinedGroups`, `joinedExpenses`) | outbox                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| What it is                                     | a copy of the server, re-downloadable                                                                                                                                                                            | writes that have not reached the server                 |
| Losing it costs                                | one pull                                                                                                                                                                                                         | the user's data                                         |
| On a version bump                              | cleared and re-pulled                                                                                                                                                                                            | migrated one operation at a time, or the upgrade blocks |
| On logout                                      | always cleared                                                                                                                                                                                                   | kept unless the caller confirms discarding it           |
| On session expiry / app update / cache cleanup | untouched                                                                                                                                                                                                        | untouched (invariant 7)                                 |

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

- flags are `0`/`1`: `archived` on accounts, categories, budgets, contacts and shared groups,
  `deleted` on transactions, shared expenses and payments;
- anything an index must skip is **omitted**, not stored as null: `liveDate` is absent on tombstones,
  `pendingReview` exists only on live rows that need review, and null foreign keys are left out;
- `dateCursor` is the compound `["liveDate", "id"]`. IndexedDB skips a record when any part of a
  compound key path is missing, which is what keeps the transaction list from walking a tombstone;
  the `id` half breaks ties between two transactions on the same date.

Rows are applied by `id` with `put`, so the deliberate 60-second cursor overlap (D-14) costs nothing.

## The shared layer

`contacts`, `sharedGroups`, `sharedExpenses` and `settlements` hold the **fact** — the outing, its
people, its lines, the split, who fronted each one and what has been settled — and nothing of the
ledger: no account, no category, no note and no link to a movement. Those live on the user's own
transactions, which carry `countsAsYours`, `sharedExpenseId`, `sharedGroupId`, `sharedSettlementId`
and `sharedHistory` and travel in `transactions` as they always did.

All four have an outbox route, so `applyPage` hands them to `reconcile.ts` like everything else. A
payment is the one write whose **movements the server mints**: the device mints its own so the list,
the day totals and the balance move together with no network, marks them with `sharedSettlementId`,
remembers their ids in the operation's `payload.minted`, and drops them when the server answers
(`DECISIONS.md`, T-123). **Undoing one takes them with it** (T-138): the mirror is walked for the
movements carrying that `sharedSettlementId` — the server's own ids by then, never the minted ones —
they are tombstoned with the payment, and the operation carries **one** effect, the net of what they
did to the account, so the balance goes back exactly the way the payment moved it.

**A movement in a group carries its expense** (T-141). The server writes the expense in the same
request that edits or deletes the movement — the amount, the date and the description, with the split
resolved again over a new amount, or the expense soft-deleted with it — so the projection does the
same: `transactions.ts` writes the mirror's expense, keeps its server copy aside and names it in the
operation's `payload.sharedExpenseId`. That name is what lets the rest follow a row with no operation
of its own: `queuedMirror` walks the operation over the expense too (with its own rules, `CARRIED` in
`reproject.ts`), the fold keeps it, `queuedRows` lists it so the group is marked, a refusal, a conflict or a discard of the movement's edit puts the expense back, and a landing moves its baseline
(`reconcileCarried`) until the next pull brings the server's. What the server would refuse for the
link — a new amount under an `EXACT` split, a new type, deleting a movement whose block of guests has
paid — is refused here with the same code, before anything is queued.

What the endpoints derive on every read — a group's `totals`, its `status`, and the state of each
person in it, which no endpoint exposes at all — is derived here too, by `derive/shared.ts`, from the
stored rows. The rules it reproduces to the minor unit are the backend's own
(`fixtures/offline/README.md`), and `derive/parity.test.ts` holds it to the `cop-shared` fixture:

- a split is `floor(total × its parts ÷ all the parts)` and the odd minor unit goes **whole to
  whoever fronted it**, in every mode, so the result never depends on the order of the rows;
- a payment belongs to the **person**, not to the line: it covers the **oldest line first** across
  every group shared with them, ties broken by expense id;
- what you hand over covers your own lines first, and whatever is left of it is their money going
  back, so it comes off what they gave you **before** any of that is imputed;
- what a movement counts as yours is `amount − what came back`, and `ADJUSTMENT` and `SETTLEMENT` are
  excluded from spending **by their type**, never by that figure;
- a write-off gives up on what was open when it was decided — the ceiling is stored on the group —
  capped again by what is open now, and it moves no figure of yours.

## Invitations

`invitationsSent` and `invitationsReceived` are the two sides of the invitations to shared groups
(T-129), exactly as the feed sends them: the inviter's rows, and the rows addressed to this person.
They are the only stores with **no outbox route** — every invitation write is about somebody else and
needs a connection — so `applyPage` puts them down as they come, and the online writes keep the
server's answer with `keepSentInvitation` / `keepReceivedInvitation` rather than waiting for the next
pull. Nothing is ever deleted from them: an invitation that stops waiting says how in its `status`, and
one that ran out of time is still `PENDING` and is judged by its `expiresAt` against `serverNow()`. **A new email on the profile empties `invitationsReceived` and starts the pull over as a
snapshot**: the invitations to the new address are older than the cursor, and the ones to the old one
no longer belong to this person.

## Groups shared with you

`joinedGroups` and `joinedExpenses` are the groups other people shared with you and their lines, as
the feed sends them (T-130): read-only, with **no outbox route**, because only the owner writes in a
group. A row's `updatedAt` is its position for you — when it changed or when you joined, whichever is
later — so a group joined after the cursor arrives whole. When a received invitation stops being
`ACCEPTED`, `applyPage` drops its group and lines, unless another accepted invitation to that group is
on the device. `transactions` carries an `addedFrom` index (the line a movement was added from with
_Add to my ledger_), which is how the screen knows what is already in your ledger without reading
every movement.

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

**A pull that brought news makes the screens read again** (F-38). Writing into IndexedDB is invisible
to React Query, so before this a change another device made landed in the mirror and the screen went
on showing what it had read until a reload. `pullChanges` answers `changed`, `startMirror` calls
`onChanged`, and `AppFrame` — the only piece here that knows React exists — invalidates every
mirror-backed domain. Two things make it cheap: with the mirror primary an invalidation is a re-read
of IndexedDB and not a request, and `changed` is **not** "rows arrived". The feed overlaps 60 seconds
on purpose (D-14), so every pull after a push replays the row that was just pushed; a row counts as
news only when its `updatedAt` is one the mirror did not already hold. Every domain is re-read rather
than the ones whose store moved: a stale screen fails in silence, and a map from entity to the
domains that show it drifts the first time a screen joins one more.

## Reading from it: `repository/`

`features/*/api.ts` calls `lib/local/repository` instead of `lib/api/client`; the hooks, the query
keys and the components do not know the difference. `read(fromServer, fromMirror)` is the seam:

- it first waits for the vault the frame said it was about to open (F-31). The screens render, and
  query, before `AppFrame`'s effects run, so a read that decided on the handle alone went to the
  server with a full mirror sitting there; `AppFrame` raises the gate while it renders and
  `startMirror` lowers it with the handle, or with null when none opens;
- **the mirror is the primary path, network or not** (O-F2b, decision 12.2). `READ_SOURCE` in
  `repository/read.ts` is the constant that says so, and setting it back to `"server"` is the whole
  way back to the fallback of O-F2a;
- it asks the mirror only once a pull has finished at least once, so the server still answers the
  first load of a device — and only that;
- a mirror reader returns `undefined` for "I cannot answer this" — an id it never saw, a query it
  does not know how to apply, a derivation with no profile to take the zone from — and the read falls
  through to the server, which produces the real network error rather than a fabricated one or an
  empty list that lies.

Everything the app still asks the server for a **read** is one of those three. The listing endpoints
and `/stats/spending` are no longer on the screens' path, and they stay in the API: they are the
oracle every parity test compares against, and other clients read them.

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

Since T-28 it **declines** rather than ignores. It used to read four parameters and drop the rest, so
the day a screen sent `categoryIds` the mirror would have answered the unfiltered month and nobody
would have known; now any parameter outside its list sends the read to the server, exactly as
`toMirrorFilter` already did for `/transactions`. What it does know is `groupBy=month` (the first
seven characters of the same frozen day key, so a month and its own days cannot disagree),
`groupBy=account` (income is keyed by the account it reached and everything else by the one it left,
falling to the other side for an adjustment that only raises a balance, and `unassigned` for
neither — the server's own `$cond`, transcribed), `categoryIds`, and
`splitBy=category`, which it accepts only over `month` or `account` and only with both bounds —
over days the splits would grow with the window, which is why the server refuses it too.
`/transactions` learned the same period: several `categoryIds`, and `sort=amount` with `order`. Any
order but the index's own (date, descending) is read whole and sorted rather than streamed — the
sort itself is 19 ms over 60 000 rows, and the walk that feeds it is the one the default path
already does to count a filtered set — and the tie follows the direction, like the server's keyset
over (field, `_id`), broken on the key itself rather than on a locale's idea of order. Both reads
decline rather than guess where the server answers with a 400: a value outside an enum, a bound
that is not ISO 8601 with an offset, an inverted window, a limit outside 1–100, a list that is
empty or names more than twenty, and the pairs the schema refuses (`uncategorized` with
`categoryIds`, `categoryId` with `categoryIds`). An id that is well formed but not a UUID is the one
shape they still answer, because it filters to nothing either way.

The cursor is the server's own: it is looked up by id, not found among the rows the filter kept, so
a pivot that was filtered out or deleted still places the page — and `hasMore` is whether a row
exists past the page, not whether the page came back full, which is what the server answers and what
the mirror used to get wrong whenever the last page was exactly full.

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
would never be asked. Mutations get the same default, for the same reason: a paused mutation never
reaches `write()`, which is what chooses the queue over the wire (the gate O-A demo found every write
frozen offline without it). A read the mirror can settle on its own does not go to the server either:
a deleted transaction's detail is the 404 its tombstone already implies (`mirrorNotFound`, F-46).

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
  the same `undefined` contract as an id it never saw;
- `total` is the whole filtered set on every page, like the endpoint's. When the query asks nothing
  of each row — no type, account, category, tag, source or `pendingDetails`, and no summary — the
  index counts it without deserialising anything and the walk stops at the page (F-15). Measured in
  Chromium over 10 000 live rows: 141 ms per page walking, 31 ms counting plus 1,4 ms walking. Both
  requests are issued before the first `await`, so they share one transaction and cannot see two
  states. A filtered query still looks at every row, which is the price of not inventing an index
  per combination of filters.

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
- **A window is a run of local days, not a range of instants** (T-14). `derive/days.ts` turns the
  bounds into the days they cover and matches them against the `dayKey` the server froze on each
  row, so a change of the account's zone cannot move a past row between months or periods — the
  same rule as the backend's, and the one the parity fixtures now carry. Two consequences here: the
  `dateCursor` range is **widened by a day at each end**, because that index is on the instant and a
  local day can sit up to 26 hours from the same day elsewhere (the exact rule is `withinDays`, the
  index only decides how many rows it looks at); and a windowed read of `/transactions` now needs
  the profile's zone, so a mirror without that row declines it and the read goes to the server, the
  way `/budgets` and `/stats` already did. A row written before the field exists carries
  `dayKey: null` and is answered by its instant, exactly as the server answers it.

**A balance from here is a projection, never a figure the server sent.** Invariant 2 of the plan
forbids painting one as if it were, so nothing renders these yet: the marking (the amber tone
already designed) arrives with the outbox in O-F4/O-F5a.

`fixtures/` is the backend's committed `lag-money-manager/fixtures/offline/` copied verbatim by
`npm run fixtures:sync` (this repo is cloned alone, so the copy has to travel with it).
`parity.test.ts` compares the two byte for byte wherever both repos sit side by side and fails on
drift; where that repo is absent it skips, saying so in its name. `npm run ci` there fails when the
backend's generator and its committed files disagree. So the chain generator → backend files → this
copy has a guard at each link — but since T-34 **every link is a command somebody types**: clone this
repo alone and nothing compares anything.

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
   pull swallows its own errors, so it never turns a saved write into an error. **The undo is the
   signal that a form is waiting** (D-35): `write()` registers it before asking for the drain and
   drops it the moment it answers from the projection, so an answer the queue cannot act on — a
   `conflict` that is not `STALE_UPDATE`, a `merged` — is thrown at the form while the undo is there,
   and left in the tray when it is not.

A create carries its own id and therefore no `Idempotency-Key` (O-B1). In the two forms that had a
keyring, the key **is** the id now, so a retried submit still names one row. `PATCH
/transactions/batch` no longer goes out as itself: `batchUpdateTransactions` queues the lot expanded
into one `transaction:update` per row, so each row keeps its own guard and its own outcome (F-20).
`POST /categories/restore-defaults` stays a plain call — the server mints those ids, so there is
nothing the mirror can project.

**A write that reached the server without going through the mirror asks for a pull** (F-33, R-3 §B3).
There are three: `sendDirect`, which is what `write()` does when there is no vault or the row cannot
be projected (`NotProjectableError` — a quick capture with no default account yet); `restore-defaults`;
and `PUT /users/:id`, whose row is the profile the derivations take their zone from. All three used
to be invisible, because the screen re-read the server. With the mirror in front the screen re-reads
the mirror, which does not have what was just saved, so each of them ends in the same pull a round
makes (`pullAfterDirectSend`). `write()` also waits for the vault gate before deciding it has none:
the screens fire their first save as early as their first read, and going direct there would skip the
outbox on the one load where the queue is the only thing that survives.

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

- **One request: `POST /sync`** (O-F5b). The queue leaves as one batch of up to 200 operations and
  up to a megabyte — `batch.ts` cuts it and keeps `seq` order — and the answer carries one status per
  operation, over the same transitions the routes used to drive one error code at a time: `applied`
  and `duplicate` leave the queue, `merged` leaves it and **repoints the local id** to the row the
  server landed on (F-57), `conflict` and `rejected` stay for the user, and `blocked` — never
  attempted, because a row it names failed earlier in the same batch — goes back in line without
  counting an attempt. `seq` on the wire is the operation's **rank inside the batch**, not the
  device's counter: the server takes an integer and uses it only to order what it applies, and the
  results are matched back by `opId`. What only the mirror needs (`payload.effect`) never travels.
  **The fallback is alive:** a `404` or `501` from `POST /sync` means a server older than this front,
  and the queue keeps leaving by the ordinary routes for the rest of the session (owner, 2026-09-06);
  a `400`/`413` on the envelope — nothing applied, this client's own bug — sends that pass one request
  at a time so each operation earns the verdict of its own route instead of the queue stalling on a
  batch nobody can fix.
- **Single flight.** One drain runs at a time; every trigger that arrives while it runs joins it. A
  request that lands _after_ the running pass took its last look at the queue is not lost — the pass
  records which request it served, and a later one asks for a pass of its own.
- **Order is `seq` and only `seq`.** Nothing is reordered and nothing is dropped for taking too long
  (invariant 7). A network failure, a 5xx, a 429 or a 401 ends the pass where it stands and the whole
  batch comes back to the queue: every operation in it counts an attempt, because a request that
  never answered may still have landed — and the same `opId` replays as a `duplicate` if it did.
- **Coalescing, before anything is sent** (`coalesce.ts`). Ten edits of one row become one request;
  a movement created and deleted with no network becomes none at all, and its row leaves the mirror
  too. Two rules make it safe: it never folds **across an operation the server has already been
  asked about** (dispatched, sending or in conflict), and the `effect.before` that survives is the
  **first** one's — the mirror stopped holding the server's row at the first write, so keeping the
  second would count that move twice. Archiving is not a removal: an archived account is still the
  user's row, so `create` + `archive` still reaches the server. A fold never moves an operation
  ahead of a create it names in `dependsOn`: that edit starts a run of its own and keeps its place.
- **Chained guards.** Every operation queued on one row reads the guard the mirror held when it was
  queued, and the client never writes `updatedAt`, so an edit followed by a delete (or an archive
  followed by a restore) both carry the stamp the first one is about to replace. **Inside one pass
  only the first operation of a row carries its `If-Match`** (D-34) — per pass, not per batch: a row
  split across two batches keeps its guard on the first one only (F-61). There is no gap to rebase
  the ones behind it in, and unguarded they open no window, because `POST /sync` blocks by entity
  id — if the first conflicts, the rest come back `blocked` without being applied. Across passes the
  rebase still happens: when an operation lands and answers a row, whatever of that row still shares its old
  guard moves to the new stamp inside the transaction that settles it, and a guard a pull moved in
  the meantime is another device's edit, left alone to earn its conflict.
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
- **`ID_TAKEN` re-mints** (F-21). O-B1 with D-17 leaves that code for an id another user owns,
  so the row takes a fresh one — in the mirror, in the rows that named it, and in the queued
  operations that named it — and goes back in line **once**. A second collision on a fresh UUID v7
  is a bug, not luck.
- **A refusal the queue cannot undo.** The rollback a write registers lives in memory, so an
  operation that outlived its tab has none: it stays queued as `failed` rather than vanishing, and
  the tray that shows it is O-F5a. The same goes for a fold with only some of its rollbacks left:
  undoing half of it would leave the mirror at an edit the server never got, so the whole run stays.
- **A `STALE_UPDATE`** is either merged by the engine or handed to the user; see below.
- **Any other `conflict`, and a `merged`, go to whoever is waiting** (D-35). A name already taken, a
  reference the server will not take, a create that landed on a row the server already had: while the
  write that queued it still holds its undo, the form gets the 4xx its route would have answered
  (`code`, `message`, `current`) and the projection is undone; when nobody is waiting — a later drain,
  a reload — the operation stays `conflict` in the tray with the server's row only if it is its own
  (`ownServerRow`). `STALE_UPDATE` on money never takes this path: it is the sheet's even with a form
  open (D-23).
- **A warning is not a failure.** An operation can land degraded: `warnings:
["CATEGORY_ARCHIVED_DROPPED"]` means the movement was saved **without** its category, because
  another device archived it while this one had no network. The write is done; what is missing is the
  explanation, so `notices.ts` keeps one per row in `meta.syncNotices` and the review screen — where
  the user picks a new category — is what reads and prunes them (F-57).

## Resolving what the queue cannot: `conflict.ts` and `resolve.ts`

A `STALE_UPDATE` means the row moved under the operation's guard. What happens next is decided in the
front, in one place, because the server does not need to know which fields are text (§6 O-F5a):

- **`conflict.ts` classifies the operation, not the diff.** An **edit** whose body carries only
  `description`, `note`, `tags`, `name`, `color`, `icon` or `pendingDetails` is `"text"`; anything
  else — money, a category, a date, a create, a removal, making an account the default — is
  `"structural"`. `pendingDetails` is the review flag the PUT behind every quick capture carries,
  neither money nor a reference (R-3). **This rests on the forms sending only what the user
  touched** (`lib/form/changes.ts`, `toTransactionChanges`): a form that names every field turns
  every disagreement between two devices into a money question, and an untouched form sends nothing,
  because the API refuses an empty `PUT` (R-5).
- **Text merges itself.** The engine rewrites the guard to the stamp the 409 answered with and puts
  the operation back in line, without a word to the user. The API's `PUT` is a partial update, so
  the other device's other fields survive; the two edits both land. It gives up after
  `AUTO_MERGE_ATTEMPTS`, and never retries against a stamp that did not move — that would only
  conflict again.
- **Money and structure ask.** The operation becomes `conflict`, and the row the server answered
  with rides along in the envelope's `serverRow`. That is why the sheet needs no second request, and
  why it can show a version the mirror no longer holds: the mirror holds **this device's**
  projection. A `DUPLICATE` answers with the row that already **holds the name**, which is somebody
  else's row: `ownServerRow` is what tells the two apart, so a foreign row is shown in the sheet but
  never becomes this row's baseline nor the guard of its retry.
- **An account archived online** answers `conflict` `RESOURCE_ARCHIVED` with the account in `current`
  — not the row the operation is about. The mirror learns the account is archived, the operation
  keeps its `archivedId`, and the way out is an operation like any other: **`account:restore` queued
  with a `seq` below the movement's**, so both travel in the same batch (F-58, D-32). Nothing needs
  to be atomic, because no outcome leaves a half-applied state: a restore that lands without the
  movement leaves the account restored — which is what the user asked for — and the movement in the
  tray. The movement also names the account in `dependsOn`, so a restore that does not land answers
  `blocked` instead of the same refusal. There is no `POST /sync/resolve` and there will not be one:
  every resolution goes out as one more operation, through the same validations (D-32).
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
  here blocks the rest of the queue: only what named a stuck row waits with it. Like every other
  screen of `(app)` it needs the marker cookie (F-75): a device whose session died still has it —
  which is the case the tray exists for — and one that signed out is sent to the login, where it
  would have found an empty tray anyway, because without a marker there is no vault.
- **The movement's own detail screen** (F-29). `outboxStatus.attentionRows` maps a row id to the
  `seq` of the first stuck operation on it, so the screen showing a movement can open the sheet for
  it. The list row cannot: it is a `RowButton`, and a button inside a button is not HTML.

Two refusals have a way out of their own, because trying again unchanged would earn the same answer:

- **`DUPLICATE` on a restore** (`isNameTaken`, F-60). The restore route takes a `name`, so
  `restoreWithName` puts the same operation back in line with `payload.body.name` changed. The sheet
  shows the row that holds the name — the `current` the backend answers the 409 with, which is
  somebody else's row and never this one's baseline, so it is dropped when the operation requeues.
- **`FUTURE_DATE`** (`isFutureDate`, F-66). `retryWithDate` rewrites `payload.body.date` and requeues,
  so it stays the same creation with the same `opId` and the same dependents behind it. The date it
  offers is the server's own: every answer carrying a `serverTime` — `POST /sync` and each page of
  `GET /sync/changes` — teaches `clock.ts` how far this device runs from the server, and the offset
  lives in `meta.clockOffsetMs` because the form needs it exactly when there is no network left to
  learn it again.

**An outbox an app update left behind** is not a refusal at all (F-65): `openVault` answers
`outbox: "blocked"` with the seqs it could not migrate, `startMirror` publishes them through
`setBlockedOperations`, and the stripe, Sync status and the tray read them from the status snapshot.
Those operations are `pending`, not stuck, so `discardOperations` does not admit them;
`discardBlockedOperations` shares its machinery, cascade included. The app keeps writing normally
while they sit there — blocking the record would be worse than not sending the old.

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
through the repository over a test vault against `expected.pending`. Every `expected.spending`
query runs through `deriveSpending`, and every one a URL can actually ask for runs through the
repository as well — the untyped ones are left out of that half on purpose, because `type` defaults
to EXPENSE before the request is built. A query added to the backend's scenarios lands here with no
change needed, which is how T-97 pinned a **transfer grouped by its category** — what the "Recent"
strip asks for on a transfer — and a transfer grouped by **account**, which proves it is keyed by
the account the money left and not by both of its ends. Everything else `npm run test`
covers against a real IndexedDB
(`fake-indexeddb`, wired in `vitest.setup.ts`): the stores and every index key, both migration policies with 20 queued operations
inside, the blocked path, the purge rules, the multi-page pull with its overlap and its stalled feed,
the four rules of the read seam, accounts, categories, transactions and Home's lists answering the
same thing online and offline, and budgets declining rather than answering without `spent`. For the
outbox: the counter across a reopen, the envelope, both halves of the atomic write (a projection
that throws and a queue put the store refuses), `dependsOn`, every branch of `write()`, and the
balance projection against the oracle on all four fixtures and over the optimistic rows. Use `openTestVault` from `lib/testing/vault` — it
tracks handles so one failed assertion does not leave a connection open and stall the next test.

## The server endpoints this layer still depends on

`READ_SOURCE` is `"mirror"`, so the screens no longer call the API on every render. The API is still
the other half of every read, and none of these may be retired on the strength of a quiet screen
(T-18): `GET /transactions`, `/accounts`, `/categories` and `/budgets` answer whenever the mirror
says it cannot — no vault yet, or no snapshot drained — and `GET /stats/spending` is the reference
`derive/parity.test.ts` checks the local buckets against, through the fixtures the backend produces.
