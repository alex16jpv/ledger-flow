# Transactions

Everything about money movements: quick capture, the full form, the list, the detail and the
pending inbox. F1 exposed only the pending count that the shell shows next to Transactions.

W-17 adds quick capture: `useQuickAdd` posts to `POST /transactions/quick` with the sheet's
`Idempotency-Key`, then adds the optional note with a `PUT` (clearing `pendingDetails` when a category
was chosen too) and invalidates every money domain (`lib/query/domains.ts`). `useDeleteTransaction`
backs the toast's Undo. The sheet itself is composed in the app layer
(`app/[locale]/(app)/QuickAddSheet.tsx`) because it needs the category and account pickers of other
features; `draftToSearchParams` carries what was typed to the full form through "More details". On a
phone the sheet fills the screen with Save in its top bar (T-150). Its category row (T-151) is
`FittedChips`: the four most used categories that fit whole in two lines together with More, which
is always drawn last, and the chosen category always among them. `AppFrame` loads the sheet through
`next/dynamic`, on a chunk of its own.

T-73 gives that sheet the three types the endpoint has always accepted. `schemas.ts` owns the shape:
`QUICK_TYPES` comes from `QuickAddTransactionInput["type"]`, `quickAddSchema` checks a transfer's two
sides in `superRefine` (both present, and different), and `quickAddInput` decides which side the one
account goes on — `fromAccountId` for an expense, `toAccountId` for an income, both for a transfer.
Nothing behind it changed: the server and the offline queue applied these same per-type defaults
already. The draft the full form receives carries the type and the second account too.

W-18 adds the full form model in `form.ts`: one Zod schema for the types the form offers (the
account side rules live in `superRefine`), `toTransactionInput` maps the form to the API payload
(explicit nulls so PUT can clear a side), `fromTransaction` prefills the edit form and
`draftFromSearchParams` reads the quick-add hand-off. `useCreateTransaction`, `useUpdateTransaction`, `useTransactionQuery`
and `useTagsQuery` back the screens in `app/[locale]/(app)/transactions/`.

T-193 adds the suggestions while you type. `suggest.tsx` owns them: `useDescriptionSuggestions` and
`useTagSuggest` load `lib/local/suggest` behind an `import()` on the first focus of a field that
suggests, read the index the store keeps per vault, and turn what it answers into the rows
`components/ui/Suggestions` draws — the typed span in bold through `splitMatch`, a tag row with its
count and the category it usually goes with. `components/DescriptionInput.tsx` is the description
field with the list under it, used by the full form, Quick add and the review inbox's card; the full
form gives `TagsInput` a `suggest` function instead of the alphabetical chips, and `useTagsQuery` now
runs only for a focused Tags field whose engine is loaded and has no index yet — a copy that cannot
answer, or one still being read — feeding the same list from `GET /transactions/tags`. The edit
form passes the row it edits so its own description and tags are taken out of the counts, and the
group's expense form passes `suggest={false}`, and a field with no type (an adjustment in the review
inbox) loads nothing. Inside Quick add the list stays in the flow of the sheet at every width
(`float={false}`), so the sheet keeps its scroll; on a page it floats from 600px up. Nothing is
written that was not typed or tapped: a row fills the text of its field and no other field.

W-19 adds the list: `filters.ts` parses and serializes the URL filters (period presets, type,
account, category, tag, pending, quick-only, search) and maps them to the API query;
`useTransactionsInfinite` pages by cursor, `usePeriodTotals` turns the server's day buckets into
the summary and the day headers, `groups.ts` only cuts the sorted rows where the day changes — the `dayKey` the server froze on the
row (T-14), so a header cannot disagree with the period total above it.
The screen and the filters sheet live in `app/[locale]/(app)/transactions/`.

W-20 adds the detail screen (`app/[locale]/(app)/transactions/[id]/`): hero with the category tile
and the signed amount, the attribute table, Edit (the W-18 form) and Delete through the shared
`DeleteTransactionSheet`, and a warning with "Complete" on pending quick entries that points at the
W-21 inbox.

W-21 adds the review inbox (`app/[locale]/(app)/transactions/review/`): one card per pending quick
entry with the recent category chips, "Other" for the full picker, a description field and "Done",
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

Date and time are the app's own controls since F-05, not the browser's: a calendar with "Today" /
"Yesterday" chips and the days past the ceiling disabled, and a wheel of hours and minutes. The form
passes tomorrow as that ceiling, so a date the server would refuse cannot be picked at all — and,
the other half of F-66, when the device's clock runs more than an hour ahead of the `serverTime` the
sync answers with, the form says so above the date instead of waiting for the refusal.

T-89 applies what T-85 and T-86 decided about recording a movement, on both surfaces.
**`FORM_TYPES` is three**: an adjustment repairs a balance rather than recording something that
happened, so it is created in **Adjust balance** and edited in `EditAdjustmentSheet`, both in
`app/[locale]/(app)/AdjustBalanceSheet.tsx` — at the app level because four screens compose them.
`useAdjustmentSheet` holds the state and the lazy import once, and every list that can show an
adjustment (the account's, the global one, Home's recent, the detail screen) asks it first and
navigates only when the row is something else; `/transactions/[id]/edit` hands an adjustment back to
its detail screen, and `isFormTransaction` is the narrowing the form's own types need. The editing
sheet reads **the one account it names** (`adjustmentAccountId` + `useAccountQuery`), never the
accounts list: a list that has not arrived, or an account past the hundredth it never returns (T-38),
would otherwise decide where the row goes. Editing asks about the adjustment's **own amount**, never
about today's balance, because recomputing a past adjustment from today's figure would silently
change what it meant.

`TypeLine` is the line under the segment plus the `?` that opens the three types explained; it binds
the full form and the quick sheet alike, because a rule that reaches one and not the other is how the
same thing comes to read two ways one tap apart. **Every type the form offers takes a category**, and
on a transfer it is optional and filtered to the TRANSFER type — the two categories every user is
seeded with stop being furniture, so the list filters by them too.

`TransferReadback` says the movement back as a **difference** once the amount and both accounts are
there: each side speaks the vocabulary of its own account — a sign for an ordinary one, _more owed_ /
_less owed_ for a debt **that owes something**, and a sign again for a card or a loan holding money of
its owner, which is every card until the script of T-90 has run. It repeats the amount typed and the
two names picked and does **no arithmetic on any balance** — house rule 4 — so it reads identically
with no network on a device that has never seen those balances, and since T-96 it **ends there**: the
clause about a total balance named a figure no screen has shown since T-85. The Pay sheet uses the same
component: one grammar, every surface.
The intent chips above _From_ and _To_ (`IntentChips`, app layer, since they open the account picker
filtered by type) only fill the two sides in the right direction; they save nothing, add no field and
touch no category, a chip whose kind of account nobody has is not offered, and none of them empties a
_From_ it has nothing to put back. Switching the type puts the chosen category aside per type rather
than dropping it, because a round trip through the segment used to lose it.

A transfer can be paid with money the app does not track (T-100): the _From_ picker carries the Pay
sheet's `Somewhere else` row, and only when the _To_ **owes money** — `owesMoney()`, a debt account
below zero, which is the same condition under which the Pay sheet offers to pay that account at all.
Everywhere else money from outside **is** income. It is never offered in the _To_: money leaving
towards something untracked is an expense. The choice lives in the form values as `fromOutside` and is
derived against the current _To_ before it is used, so a _To_ that stops owing takes the row and the
choice with it; `toTransactionInput` then writes an `ADJUSTMENT` with one side, no category and — when
the user typed none — the Pay sheet's description. `TransferReadback` takes `outside` and says the
single side through the same `sideKey`, which is why the Pay sheet renders it too instead of writing
that sentence itself.

Since T-98 the inbox is not expenses-only: a quick **income** lands there too, so each card asks for
the categories of **its own** type — `ReviewCard` reads them itself rather than being handed one list,
which is also what keeps a type that is not on screen from being fetched — and paints the amount with
its type's colour and sign over the account the movement touches. `reviewCategoryType` is the single
place that says which types can carry a category at all. In the list, `transactionTitle` names a quick
entry with nothing else to show after its type ("Quick income", not "Quick expense").

Since T-120 the list carries a **fifth** kind of movement, the payment between people a settle-up
writes. `reviewCategoryType` refuses a category on it as it does on an adjustment, and `amountKind`
reads the **row** rather than the type alone, because a payment goes both ways: collecting reaches an
account and is signed `+`, giving somebody their surplus back leaves one and is signed `−`. Both are
neutral in colour — money moved, but it was neither income nor spending. A payment has no quick label
because it is recorded from `Settle up` and nowhere else.

A movement also carries **what counts as yours** — what left the account minus what has come back for
it — and the list deliberately does not read it: a row's amount, a day's total and the summary stay
gross, because a list of movements is what moved through the accounts. Stats and the budgets are the
ones that measure the other figure.

**T-124 made the shared layer visible where it is used.** A row of a shared expense carries a `users`
badge and says **your share** under the gross amount; a payment reads as **the person it was with**,
with a `hand-coins` tile, a `Payment` badge and the group underneath. Neither reads the shared feature:
`TransactionLookups` gains **plain maps** the app layer fills from the section (`sharedLookup`), so a
feature still never imports another, and the section is only asked for when the loaded page actually
holds something shared. The **type filter** gains the fifth kind (`FILTER_TYPES`); the Add form does
not (`FORM_TYPES`), because a payment is recorded from `Settle up` and nowhere else.

The detail is where the third figure lives: a card leading with **what counts as yours**, a row per
participant with their state — which can read `Paid` here and `Partially paid` in the group, because a
payment covers the oldest expense first — `Edit split` and `Settle up`, a `Shared group` attribute, and
**the history**, one line per event with the figure it left behind. Deleting one people have paid for
says what it drags and what it does not: no payment is deleted, and writing it off is offered instead
when exactly one person is left owing, which is when that is a single unambiguous act.
