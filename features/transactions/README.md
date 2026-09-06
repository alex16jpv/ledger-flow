# Transactions

Everything about money movements: quick capture, the full form, the list, the detail and the
pending inbox. F1 exposed only the pending count that the shell shows next to Transactions.

W-17 adds quick capture: `useQuickAdd` posts to `POST /transactions/quick` with the sheet's
`Idempotency-Key`, then adds the optional note with a `PUT` (clearing `pendingDetails` when a category
was chosen too) and invalidates every money domain (`lib/query/domains.ts`). `useDeleteTransaction`
backs the toast's Undo. The sheet itself is composed in the app layer
(`app/[locale]/(app)/QuickAddSheet.tsx`) because it needs the category and account pickers of other
features; `draftToSearchParams` carries what was typed to the full form when the user asks for
"More details".

W-18 adds the full form model in `form.ts`: one Zod schema for the four types (the account side
rules live in `superRefine`), `toTransactionInput` maps the form to the API payload (explicit
nulls so PUT can clear a side), `fromTransaction` prefills the edit form and `draftFromSearchParams`
reads the quick-add hand-off. `useCreateTransaction`, `useUpdateTransaction`, `useTransactionQuery`
and `useTagsQuery` back the screens in `app/[locale]/(app)/transactions/`.

W-19 adds the list: `filters.ts` parses and serializes the URL filters (period presets, type,
account, category, tag, pending, quick-only, search) and maps them to the API query;
`useTransactionsInfinite` pages by cursor, `usePeriodTotals` turns the server's day buckets into
the summary and the day headers, `groups.ts` only cuts the sorted rows where the local day changes.
The screen and the filters sheet live in `app/[locale]/(app)/transactions/`.

W-20 adds the detail screen (`app/[locale]/(app)/transactions/[id]/`): hero with the category tile
and the signed amount, the attribute table, Edit (the W-18 form) and Delete through the shared
`DeleteTransactionSheet`, and a warning with "Complete" on pending quick expenses that points at the
W-21 inbox.

W-21 adds the review inbox (`app/[locale]/(app)/transactions/review/`): one card per pending quick
expense with the recent category chips, "Other" for the full picker, a description field and "Done",
which `PUT`s `categoryId`, `description` and `pendingDetails: false`; the pending count in the shell
follows because the mutation invalidates the transactions domain.

O-F5b adds one line to a card, when there is one to add: a movement the server saved **without** its
category — archived on another device while this one had no network — says so, because that warning
(`CATEGORY_ARCHIVED_DROPPED`) is the only place the reason exists. `pruneNotices` reads them off the
vault when the screen opens and drops what no longer needs a review (F-57).

F-07 adds "Save all" to the inbox: the card drafts live in the screen, a sticky button counts the
cards that already have a category, a sheet confirms how many save and how many stay pending, and
`useBatchComplete` saves them. Since O-F4 part 2 the lot goes through the outbox expanded into one
operation per row rather than one `PATCH /transactions/batch`, so it works with no network too; the
result is still per item, saved cards leave the list, failed ones stay with their error, and the
individual "Done" keeps working.

Reads go through `lib/local/repository`: since O-F2b the paged list, the detail, the counts, the
pending tray and the tag list answer from the mirror whenever a pull has drained, network or not, and
reach the server only where the mirror cannot answer. The mirror resolves the cursor as a keyset over
`(date, id)` — the same one the API uses — so infinite scroll and every filter work without network;
a filter the mirror does not know how to apply makes it decline and the read goes to the server.
`fetchDailyStats` goes through the stats seam and answers offline since O-F3 part 2: its buckets are
the user's local calendar days, derived over the window's rows. Writes go through `lib/local/outbox` (O-F4): the
movement and its operation land in one transaction and the screen is answered from the projection,
so capture works the same with and without network. The idempotency key is the row's id now, and
each money operation records what it replaced so the balance projection knows what the server still
has. `batchUpdateTransactions` queues one `transaction:update` per row and drains them in a single
pass: one `If-Match` cannot guard N rows, so each row carries its own guard and its own outcome
(F-20). Online that is N requests where it used to be one. Since O-F5a a row whose own write is
still queued says so: the amber "Pending sync" badge and the "saved on this device" meta, turning
red ("Needs attention") once the server refused that write — the resolution sheet itself opens from
the connection banner's "Review".
