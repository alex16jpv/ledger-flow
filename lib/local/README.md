# `lib/local` — the offline vault

One IndexedDB database per user, `lf-vault-<userId>`. Two users on a device never cross; signing back
in with the same `userId` finds the same vault **and the same outbox**.

Delivered by O-F1 (plan §6). This item is the store and its migrations only — what gets written into
it and when is O-F2a (mirror), O-F3 (derivations) and O-F4 (outbox).

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

## Persistence

`requestPersistentStorage()` asks for `navigator.storage.persist()` and reports
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
inside, the blocked path, and the purge rules. Use `openTestVault` from `lib/testing/vault` — it
tracks handles so one failed assertion does not leave a connection open and stall the next test.
