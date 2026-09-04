# `lib/local` — the offline vault

One IndexedDB database per user, `lf-vault-<userId>`. Two users on a device never cross; signing back
in with the same `userId` finds the same vault **and the same outbox**.

Delivered by O-F1 (the store and its migrations) and O-F2a (filling it, and reading accounts,
categories, transactions and Home's non-money lists from it while offline). Deriving money locally
is O-F3; the outbox is O-F4.

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
`GET /sync/changes` sent — `lib/local/derive` (O-F3) is checked against
`auditoria/offline-fixtures/`, and that comparison only means something if the server's shape arrives
untouched.

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

Scheduling lives in `mirror.ts`. `startMirror(userId)` opens the vault, calls
`requestPersistentStorage()` and pulls: on open, on regaining focus once the copy is older than
`PULL_STALE_MS`, and when the network comes back. **Never on a background timer** — plan §4.2: a
30-second poll is 2 880 requests a day per device, worse than the traffic local-first exists to
remove. `AppFrame` starts it with the signed-in user and tears it down when that user changes.

## Reading from it: `repository/`

`features/*/api.ts` calls `lib/local/repository` instead of `lib/api/client`; the hooks, the query
keys and the components do not know the difference. `read(fromServer, fromMirror)` is the seam:

- while there is network it calls `fromServer` and the online path is exactly what it was (O-F2a).
  `READ_SOURCE` in `repository/read.ts` is the single constant O-F2b flips to make the mirror the
  primary path, once the whole suite passes with it in front;
- with no network it asks the mirror, but only when a pull has finished at least once;
- a mirror reader returns `undefined` for "I cannot answer this" — an id it never saw, for instance —
  and the read falls through to the server, which produces the real network error rather than a
  fabricated one or an empty list that lies.

`repository/budgets.ts` declines every read on purpose. The mirror stores `SyncBudget`, the saved
shape, while the API answers the view, and the only field of that view the mirror cannot build is
`spent` — which every budget surface reads. So the whole read goes to the server until
`lib/local/derive` lands (O-F3), rather than being served with a figure nobody computed.
`/stats/spending` is the same case for Home's month and for the whole stats feature.

`lib/query/domains.ts` lists the domains whose reads all answer locally, and its prefix covers every
key of a domain: `budgets`, `home` and `stats` are not in it, because unpausing a domain that still
has a server-only read turns a paused skeleton into a failed request.

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

`npm run test` covers this directory against a real IndexedDB (`fake-indexeddb`, wired in
`vitest.setup.ts`): the stores and every index key, both migration policies with 20 queued operations
inside, the blocked path, the purge rules, the multi-page pull with its overlap and its stalled feed,
the four rules of the read seam, accounts, categories, transactions and Home's lists answering the
same thing online and offline, and budgets declining rather than answering without `spent`. Use `openTestVault` from `lib/testing/vault` — it
tracks handles so one failed assertion does not leave a connection open and stall the next test.
