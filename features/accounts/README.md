# Accounts

Money holders: list, detail, create/edit, main account, archive/restore (W-23) and balance
adjustments (W-24).

On a CARD, an OVERDRAFT or a LOAN the Adjust balance sheet asks **the debt**, not the stored balance
with its sign (T-95): the Positive / Negative pair becomes **Owed / Your own money** — an overdraft
in positive is ordinary and a card can be overpaid — the question follows whichever is chosen, and
the difference reads as "less owed" / "more owed". `debtFieldOf` picks the shape; what reaches the
server is the same ADJUSTMENT as for any other account.

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

**Past zero the three types part ways (T-101).** A CARD or an OVERDRAFT can sit in its owner's
favour, so it keeps leading with what is available — the limit **plus** what is on it — with `$0 owed
of $limit · $own of your own money on it` under an empty bar; without the field there is no scale, so
it says only that the money on it is theirs. A LOAN cannot: it reads as **finished**, `$0 owed` with
the bar **full**, and money of its owner is never named on one. That is why `PaySheet` caps a loan's
amount at what is still owed and `AdjustBalanceSheet` drops the _Your own money_ side there, while
both keep taking it on a card.

The two fields are optional and belong to the types that have them (`creditLimit` on CARD and
OVERDRAFT, `borrowedAmount` on LOAN). On creation the amount field asks _How much do you owe on it
right now?_ and stores the answer as the debt; changing an account's type clears the amount the new
type cannot carry **in the same write**, because the server refuses to leave one behind rather than
dropping it quietly (`ACCOUNT_FIELD_NOT_FOR_TYPE`). Offline, the mirror keeps whatever a create sent
and a cleared field leaves the row exactly as the server answers it: absent, not null.

The summary card and Home's stats row say **what you have** and **what you owe**, with no net figure
anywhere: a car loan against a bank account reads negative for years, and that is not the number
those screens are for. `splitAccounts` decides what goes where, and since T-102 a **loan past zero is
in neither**: its card reads as finished and never names that money, so a header that counted it
would contradict the card one screen down. It is the same `mayHoldOwnMoney` the card reading uses, so
the two cannot drift. A card and an overdraft are the opposite case and keep counting.

**The account picker filters by what a movement may touch (T-93).** The sheet takes `only` (the
intent chips' positive filter) and `omit` (a negative one), plus a `note` appended to its footer.
Under **Income** the form and the quick capture pass `omit={INCOME_REFUSED_TYPES}` — a card and a
loan — and the note that says why: money arriving there is a payment, and the server refuses it as
income. An **overdraft** is not on that list, because a positive balance is its ordinary state and a
salary landing there is income (owner's decision, 2026-09-18). The rule itself is the server's; this
is only what keeps the client from offering what it would refuse, and the note is shown only when
there was something to leave out. Since T-103 the list is not this repository's to decide: the
contract publishes it as `IncomeRefusedAccountType`, and `lib/api/contract.test.ts` pins
`INCOME_REFUSED_ON` to it, so the first regeneration after the server changes the rule fails
typecheck here instead of leaving the picker quietly offering what would be refused.

`PaySheet` (app layer, because it composes transactions) is the one primary action on a debt
account's own screen: the amount, one `From` picker and the optional TRANSFER category, and on a LOAN
it refuses anything above what is still owed — since T-94 that ceiling applies to the **principal**, not
to the instalment. **The amount opens empty** (T-99), with the keyboard up
as the Quick add does, and the whole debt is one chip carrying its own figure that fills the field —
the total is an option, never what the sheet has already decided for you. The chip fills the field by
remounting `AmountInput` through a `key`, which is how the Quick add resets it too; the sheet counts
as unsaved from the moment anything is typed. It writes a TRANSFER
towards the account — paying a debt means sending money
**towards** the card — through the same queue and the same client-minted id as the form. Its `From`
picker carries one row that is not an account, for money the app does not track; that writes a
one-sided ADJUSTMENT, never an income, because an income would lift _Income this month_ and
_Estimated savings_ by money nobody earned.

`AccountPicker` is the `Picker` row and `AccountPickerSheet` the list behind it, split the way the
category picker already was (T-89): the sheet is opened on its own by the transfer intent chips, which
need it filtered to a kind of account (`only`). Both take an `outside` row that is not an account —
the sheet lists it under the accounts and explains it in the footer, the closed `Picker` keeps saying
it once it is the choice — and since T-100 the transfer in the full form passes it too, on the same
condition the Pay sheet itself appears on: the account owes money (`owesMoney`). `PaySheet` reads its
movement back through the shared `TransferReadback`, including the one-sided sentence for money from
outside, so the sentence is the same one the transaction form shows.

**On a LOAN the sheet also asks how much of the instalment was interest** (T-94, the owner's decision of
2026-09-18). Filled, it saves **two** movements instead of one: the `TRANSFER` of the principal first,
because that is the payment, and then an `EXPENSE` for the interest against the seeded `interest`
category, which the client finds by `seedKey` and never by name — an account without it is asked for one
in a row that mounts with the sheet. The two are not atomic (`POST /sync` applies its operations one at a
time), so when only the transfer lands the sheet stays open, `InstalmentReadback` marks which half is
saved and which was refused, and the button becomes _Send it again_ and resends only the interest. With
no network both are queued and a later refusal surfaces in the attention tray, not here.
