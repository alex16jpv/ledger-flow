# Accounts

Money holders: list, detail, create/edit, main account, archive/restore (W-23) and balance
adjustments (W-24).

`AccountPicker` (W-16) is the shared account selector: a `Picker` that opens a sheet listing the
active accounts with their type tile, "Main" badge and live balance. `exclude` hides one account so
the two sides of a transfer can never be the same; archived accounts are not offered.

`AccountsView` (W-23) loads the whole list once with `includeArchived=true` (a user is capped at
100 accounts, one page) and derives the summary card, the active grid and the folded "Archived"
section through `summarizeAccounts`. `AccountForm` creates and edits: the balance field exists only
on creation (it becomes the immutable `openingBalance`), a live `AccountCard` previews the result and
a `409 DUPLICATE` is shown under the name with the case-insensitive explanation. The detail screen
lives in the app layer because it composes the transactions of the account; the confirmation sheets
(`MakeMainSheet`, `ArchiveAccountSheet`, `RestoreConflictSheet`) and `AccountHero` live here.

Reads go through `lib/local/repository`: since O-F2b `fetchAccounts` and `fetchAccount` answer from
the mirror whenever a pull has drained, network or not, and reach the server only where the mirror
cannot answer — a device with no snapshot yet, or an id it never saw. Writes go through `lib/local/outbox` (O-F4): the account lands in the mirror and its operation in
the queue in one transaction, the screen gets that projection, and the server is asked afterwards. A
create carries its own id, so no `Idempotency-Key`. The balances on this screen are the mirror's
`balance` plus the effect of the queued operations, and they carry the amber projection mark while
the queue is not empty (invariant 2).

Since F-03 the type is chosen in one `picker` row that shows the type with the line explaining it —
"Bank account · a checking or current account" — and opens a sheet with the nine and a description
each. The onboarding gets the same control by rendering the same `AccountForm`, so there is one way
to choose the same thing (§8.4, §8.6).

Since T-74 a **new** account's colour picker opens on one of the sixteen tokens drawn at random, not
on `BLUE`, so accounts created without ever opening the picker no longer all come out the same
colour. The edit form does not draw: an account whose `color` is `null` still falls back to `BLUE`,
because an untouched field never reaches the `PUT`.

Since T-78 `AccountForm` reports React Hook Form's `isDirty` to the sheet around it
(`useUnsavedGuard`), so a tap outside asks before throwing a half-written account away. On the pages,
where the form is not in a sheet, the hook does nothing.

## A debt account reads as debt (T-88)

`lib/accounts/debt.ts` decides the whole reading and four surfaces print it: the card in
`AccountsView`, Home's carousel, `AccountHero` and `AccountPicker`. A CARD or an OVERDRAFT leads with
what is **available** (`creditLimit` minus what is owed) and carries `X owed of Y` under a bar of the
limit in use; a LOAN leads with what is **owed** and its bar is what has been paid off, because a
loan has nothing available and cannot be re-borrowed. The bar arrives with the field, not with the
debt: an account whose field is empty says only what is owed and carries a button to
`/accounts/:id/edit`, which is where the field lives. Money of the owner's own sitting on a debt
account is named as theirs — the state every card is in until T-90 runs.

The two fields are optional and belong to the types that have them (`creditLimit` on CARD and
OVERDRAFT, `borrowedAmount` on LOAN). On creation the amount field asks _How much do you owe on it
right now?_ and stores the answer as the debt; changing an account's type clears the amount the new
type cannot carry **in the same write**, because the server refuses to leave one behind rather than
dropping it quietly (`ACCOUNT_FIELD_NOT_FOR_TYPE`). Offline, the mirror keeps whatever a create sent
and a cleared field leaves the row exactly as the server answers it: absent, not null.

The summary card and Home's stats row say **what you have** and **what you owe**, with no net figure
anywhere: a car loan against a bank account reads negative for years, and that is not the number
those screens are for.

`PaySheet` (app layer, because it composes transactions) is the one primary action on a debt
account's own screen: the amount preloaded with everything owed, one `From` picker and the optional
TRANSFER category. It writes a TRANSFER towards the account — paying a debt means sending money
**towards** the card — through the same queue and the same client-minted id as the form. Its `From`
picker carries one row that is not an account, for money the app does not track; that writes a
one-sided ADJUSTMENT, never an income, because an income would lift _Income this month_ and
_Estimated savings_ by money nobody earned.

`AccountPicker` is the `Picker` row and `AccountPickerSheet` the list behind it, split the way the
category picker already was (T-89): the sheet is opened on its own by the transfer intent chips, which
need it filtered to a kind of account (`only`). `PaySheet` reads its movement back through the shared
`TransferReadback`, so the sentence is the same one the transaction form shows.
