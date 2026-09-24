# Transactions

`preview/transactions.html`

## List (`#list`)

Search (on the client over the loaded page, plus a `tag` filter when it starts with `#`), a row of
chips — "Filters" with the count of active filters (it opens the filters sheet), the period (this month
by default), the type, "To review · n", "Uncategorized" and recent tags. A summary card for the period
(spent, income, number of transactions). The list is grouped by day, with a `day-head` carrying the
day's total, in the user's zone. **Those figures are gross**: a row's amount, a day's total and the
period summary are what moved through the accounts, which is what a list of movements is for. Stats
and the budgets use what counts as yours, which for a shared expense is smaller — the two are not the
same number and the detail is where the difference is explained ([shared.md](shared.md)).

A row shows the category tile (or a neutral `hash` when there is none), the description or the
category's name or "Quick expense" / "Quick income" for a quick entry with neither, the time · the account, and the amount signed by type; an
ADJUSTMENT carries an "Adjustment" badge and a `scale` tile; a QUICK entry still to detail carries an
amber background and its badge. A **shared** one carries a `users` badge and, under the amount, **your
share** — the owner's decision: the row keeps the full amount on the right, because that is what left
the account and what the month is counting today, and says underneath what the split says is fairly
yours. The third figure — what counts as yours right now, somewhere between the two and moving with
every payment — belongs in the detail, next to the history that explains it
([shared.md](shared.md)). Infinite scroll through `hasMore`/`nextCursor`; on `INVALID_CURSOR` the
list reloads from the start with the toast "List updated". The header's download button opens the
download sheet ([Download](#download-export)).

## Filters (`#filters`)

Period with presets (this week, this month, last month, this year, custom) and two date fields; type
(all, expenses, income, transfers, explicit adjustments, payments between people); account (chips with a tile); category (recent
chips plus "More", which opens the picker, plus "Uncategorized" = `uncategorized=true`), **offered
for the type the filter is on** — since T-86 that includes the ones marked Transfer, and a category
chosen under another type is dropped when the type moves, because that pair matches nothing; tag
(`tag=`);
and the switches "Only what is still to review" (`pendingDetails=true`) and "Only quick entries"
(`source=QUICK`). The footer holds "Clear" and a primary button that anticipates the count — "Show 12
transactions" — by asking with `limit=1` and reading `pagination.total`, which exists on every listing
and respects the filters. Active filters appear as selected chips in the list and can be removed one by
one.

## Download (`#export`)

T-188. The header's `download` button opens a centred sheet, **Download transactions**, with two
choices and one button. Decided with the owner on 2026-09-24: **Excel and CSV**, chosen in the sheet;
**what the list is showing, with everything one tap away**; a shared expense carries **its full amount
and its share**; the file is written **in the app's language**.

- **What** — a radio group of two rows, each with a visible radio mark. _What you're viewing_ is
  chosen by default and reads the count and the filters in force: "142 transactions · September ·
  Bancolombia". It is exactly the list — every filter, the period **and the search**, over every page,
  not only the ones scrolled. The count comes from `pagination.total`, which ignores the search, so
  **with a search in force the device counts the matches first** (`#export-counting`): the line waits
  on a skeleton and the button is disabled for that moment. _All transactions_ reads "1,284
  transactions · since March 2024" and ignores filters and search. **When the list is empty**
  (`#export-empty-view`) the first row is off, "Nothing matches these filters", and _All transactions_
  is chosen. **When the two are the same** — period _All_, no filter, no search — the group collapses
  to one line, "All transactions · 1,284".
- **Format** — the app's segmented control (`Segment`), _Excel (.xlsx)_ by default and _CSV_, with a
  line under it that says what the chosen one is for: "Opens in Excel, Google Sheets and Numbers, with
  real dates and numbers." or "Plain text, comma-separated (UTF-8), for other apps. Excel in Spanish
  opens it from Data › From Text." (`#export-csv`).
- One muted line: "Made on this device, from your copy when it has one. Anything still waiting to sync
  is included and marked in the file."
- Footer: `Cancel` and the primary "Download 142 transactions", whose count follows **What**.

**The header button** is disabled while the list has no first answer (loading or failed) and when
there is nothing to download at all — no transactions, known from an unfiltered count of zero; the
list's own state already says why in each case.

**Where the rows come from.** From the device's copy whenever it can answer, so it is the same
offline, with a dead session and in _this device only_ — a person with no account must be able to take
their data out, and the file holds nothing the screen does not already show. When the copy cannot
answer (its first download has not finished, or this browser cannot keep one) and there is a network,
the rows come from the server, page by page, behind the same spinner. **Offline with no copy**
(`#export-offline-no-copy`) is the one case with no source: a `warning` alert, "Needs a connection:
this device doesn't have a copy of your transactions yet.", and the button disabled.

**Preparing** (`#export-preparing`): the primary button spins in place, keeping the name "Preparing
file…", announced politely; the choices freeze, and `Cancel` and the close button stay live and stop
the build. **Handed over** (`#export-done`): the sheet closes, focus returns to the download button,
and a toast names the file, "Downloading ledger-flow-transactions-2026-09.xlsx". It never says
"Saved": the browser can still ask, block or cancel, and the app cannot know. On an iPhone's installed
app, where a download opens a viewer, the file goes to the share sheet instead. **If building it
fails**, a `danger` toast, "We couldn't create the file.", with its reference (the Sentry event id,
since the failure is reported) and `Retry`; nothing is handed over. **If a shared row's figures cannot
be read** (the shared section failed to load), that is the same failure: a file with holes is never
produced.

### The file (`#export-file`)

One row per transaction, **oldest first**, and these columns, named in the app's language:

| Column      | What it holds                                                                                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date        | The day the row froze (`dayKey`), `2026-09-22`; when it has none, the day in the current time zone, as the list does                                                                                                                                                                                       |
| Time        | The hour in the current time zone, `08:42`. After a change of zone, a row near midnight can read a Date that is not the day of its Time; the list has the same property, and _About_ names the zone                                                                                                        |
| Type        | Expense, Income, Transfer, Adjustment or Payment                                                                                                                                                                                                                                                           |
| Description | The row's title as the list shows it: the description, else the category, "Quick expense", the transfer's two accounts, the person of a payment                                                                                                                                                            |
| Category    | The category's name, archived ones included; empty when there is none                                                                                                                                                                                                                                      |
| Amount      | **Negative when money left an account, positive when it arrived**: an expense negative, an income positive, an adjustment and a payment by their direction, a transfer without a sign. For a shared expense, the full amount. The list draws a raised adjustment as `±`; the file cannot, and gives it `+` |
| Currency    | The ISO code, `COP`; the amount's decimals follow it, row by row                                                                                                                                                                                                                                           |
| Account     | The account the row touches first: the source, or the destination when there is only one (an income, a raised adjustment, a payment that arrived); archived ones included                                                                                                                                  |
| To account  | The destination of a transfer, empty otherwise                                                                                                                                                                                                                                                             |
| Your share  | A shared expense's share of yours, with the amount's sign; empty on every other row                                                                                                                                                                                                                        |
| Tags        | `#coffee #latte`                                                                                                                                                                                                                                                                                           |
| Note        | The note                                                                                                                                                                                                                                                                                                   |
| To review   | "Yes" while it is still to review                                                                                                                                                                                                                                                                          |
| Source      | Manual, Quick or Import                                                                                                                                                                                                                                                                                    |
| Sync        | "Pending sync" or "Needs attention" while it, or the shared expense it carries, is only on this device — the same rule as the row's badge. A row that needs attention holds the server's version, not the change the server refused                                                                        |
| ID          | The transaction's id, to tell two identical rows apart and to find one in the app                                                                                                                                                                                                                          |

Summing **Amount** over a mix of types adds transfers and full shared amounts; the _Type_ column is
there to filter by. **Excel**: one sheet, _Transactions_, with the header frozen and filters on, Date
and Time as real date and time cells built from the text (never through the browser's clock), and the
amount as a number with its currency's decimals; a second sheet, _About_, says what was downloaded,
the filters and search in force, the time zone and when the file was made. **CSV**: UTF-8 with a BOM
(so Excel reads accents), comma-separated, quoted where needed, CRLF line ends; dates and times as
above, amounts with a dot for decimals and no thousands separator (`-12500`). In the CSV, a text cell
that begins with `=`, `+`, `-`, `@`, a tab or a carriage return is written with a leading `'`, because a
description can come from somebody else's group and must never run as a formula; the Excel file needs
no such mark, because its text cells are never formulas.

**The name** is always in English, like every file name the app writes, and says what is in it:
`ledger-flow-transactions-2026-09` for a month (this month, last month), `…-2026` for this year,
`…-2026-09-15_2026-09-21` for this week or a custom range, `…-all` for everything, and `-filtered` at the
end when any other filter or a search was in force.

## Detail (`#detail`)

A centred hero (lg tile, amount, description, type · account), a table of attributes (category,
account or accounts, the long date, tags, note, source, currency), the actions Edit (the form,
preloaded) and Delete (confirmed in a sheet; a soft `DELETE`; a toast without undo, because there is no
restore), and a footer with created and edited.

**When deleting it would leave a loan above zero** (T-156) — money it took out of a loan that has been
paid off since — the delete is refused, by the device before it queues anything and by the server
otherwise. The sheet closes and a `danger` toast says why and what to do first: _This loan was paid off
after that was recorded, so taking it back would leave the loan above zero. Lower that payment first,
then try again._ Nothing is deleted and the balance does not move. The same toast answers every gesture
that takes something back — deleting from the edit form or an adjustment, undoing a payment
([shared.md](shared.md)) — and editing it down or off the loan is refused in the form's own alert
([add.md](add.md)).

If `pendingDetails`, a `warning` alert on top offers "Complete", which opens the review inbox
positioned on that item.

**If the row carries a change the server did not take** (`#detail-with-unsynced-change`): a `danger`
alert, "Some changes need your attention. This transaction has a change the server hasn't taken.", with
a "Review" button that opens the conflict sheet over that operation. It is the second way into that
sheet, besides the red stripe.

## A payment between people (`#a-payment-between-people`)

The fifth kind of movement, and the list has to show it: money arrived in an account, so a list that
hid it would not explain the balance. It reads as what it is — a `hand-coins` tile, the person's name,
a **Payment** badge, the shared group underneath, and the amount **neutral with a `+`**. It
is not income: no category, out of Stats and out of Budgets, exactly like an adjustment, and never
green ([shared.md](shared.md)).

**It goes both ways.** Giving somebody back what they paid ahead of their share leaves an account, so
the same row carries a `−`, still neutral and still with no category: you never spent it. The plate
draws the pair, because a kind of movement that is only ever drawn in one direction is a kind half the
product has never seen — and the day's total is the two of them together.

The day's total moves with it, because the day's total is what the day did to your money. **The type
filter gains it**; the Add form does not, because a payment is recorded from `Settle up` and nowhere
else, and a type in the form that the form cannot correctly create is the contradiction T-86 had to
undo for Transfer categories.

**Its detail reads as a payment** — the `hand-coins` tile of its row, the counterparty's name, and the
shared groups it settled on a badge — and **offers no Edit and no Delete** (`#payment-detail`): the money belongs to the payment, and
the server refuses to move it on its own. The screen says that in one line rather than offering two
buttons that always fail — and under that line it offers **the door that does exist**, `Undo the
payment`, which is the same sheet the person's `Payments` list opens and takes this movement with it
([shared.md](shared.md)). A line that named a door and left the reader to find it was the cost of
saying it before the door was built. **While the payment cannot be read** the button is not drawn and
the screen says why, the way it already does for an expense it cannot read: a door that fails is worse
than a door that is honestly missing for a moment.

## A shared expense (`#shared-expense`)

Between the hero and the attributes, a card for the group. It leads with **what counts as yours** —
the figure Stats and the budgets use — and one sentence saying how it got there: your share, plus
whatever is still owed or was written off. Then a row per participant with their share and their
state, and two actions, `Edit split` and `Settle up`. The attribute table gains a **Shared group** row
that opens the group.

**When a block of guests has paid, its payments are listed here** (`#shared-expense-guest-payments`),
under `Paid by the guests`, and each one undoes itself like any other ([shared.md](shared.md)). This is
the only place they can be: a block lives in **this expense alone** — it is not a person, it never
reaches the `People` face, and it has no page of its own — so without this list a payment to a block
could not be taken back, while the expense could not be deleted either, because the server refuses to
lose a block that has paid (`GUEST_BLOCK_HAS_PAYMENTS`).

**Then the history, and it is not an extra.** One line per event that could have changed the figure,
with its date, what happened and the figure it left behind — and an event that changed nothing says
so. That is the point: splitting an expense and writing one off **never** move it, because the money
had already left the account; only a payment does, and it moves the month the expense happened in.
Without this list, a figure that falls two weeks later in a month already closed is inexplicable.

A participant can read `Paid` here and `Partially paid` in the group, because a payment covers the
**oldest expense first** ([shared.md](shared.md)).

**While a write to its group waits in the queue** (`#shared-expense-pending`), the card marks what that
write touches and nothing else, by the rule of [shared.md](shared.md): the lead figure when its group is
marked or the movement itself was edited here, a person's row when their figure in the group is, and a guests' payment row with its own
`Pending sync`. The history is not marked: every line of it is one the server wrote.

## Added from a group shared with you

An expense created by `Add to my ledger` ([shared.md](shared.md#add-to-my-ledger-add-to-my-ledger)) is
**an ordinary expense of yours**: your account, your category, your budget, and no shared card, because
the group it came from is somebody else's and what counts as yours is its whole amount. The attribute
table gains one row, **Added from**, reading "Villa de Leyva weekend, shared by Ana Ruiz". It is edited,
moved and deleted like any other, and deleting it makes that line ready to add again.

## Deleting one people have paid for (`#delete-a-shared-expense`)

The ordinary delete confirmation, plus what it drags — and the surprising half is what it does **not**
do. **No payment is deleted**: a payment belongs to the person, not to one expense, so what has
arrived stays and re-imputes over the expenses that are left, each of which records it in its history.
What does change is **what everybody owes**, because the group now costs less and every share falls
with it — which can leave somebody who already paid ahead of their new share. The sheet says both, and
names the account and the figure it moves.

It also offers what was probably meant — **writing it off**, which keeps the expense and its history —
because "nobody is going to pay me" and "this never happened" are different statements and only one of
them is a deletion.

## A row with something queued

While the write waits, the row carries the `warning` badge "Pending sync" (`cloud-off`); when its
operation is in conflict or was refused, the badge becomes `danger` **"Needs attention"**. In both
cases the metadata adds "Saved on this device". A movement put into a shared group with no network
carries it too, because its `Shared` badge and its share are the group's write that is waiting.

## Offline with no local copy (`#offline-without-a-copy`)

An honest empty state with a `wifi-off` tile, "You're offline", "The list will load when you're back
online." and a Retry, under the amber stripe. It happens when the read reached the network and there
was none — a device whose copy cannot answer this list — and **only** then: a request that left and ran
out of time is a slow server, not a missing network, and says so with its own reference. With a copy
that can answer, the list never leaves the device.

## Review inbox (`#review-inbox`)

An explanatory alert (the money already moved the balance, and the expenses among them already count
against the global budget), then one card per quick add with the amount, the date · the account, chips
of the most used categories plus "Other" (the full picker), a description and "Done" (`PUT` with
`categoryId`, `description`, `pendingDetails: false`); "Open full form" leads to the form. After the
last one, an empty state, "All detailed", with a way back to Home.

**The inbox is not only expenses (T-98).** What reaches it is a quick capture still waiting to be
completed, and since T-73 the Quick add records an **income** too. Almost always that is an expense or
an income with no category: a transfer is completed by the follow-up `PUT` the Quick add sends, and
only reaches the inbox when that `PUT` failed. Each card therefore reads **its own type**, whichever it
is, and nothing on it is fixed to expense:

- the amount takes its type's colour and sign — an expense `−$12,500` in `--expense`, an income
  `+$1,200,000` in `--income` — which is how money in and out is told apart everywhere else;
- the account named is the one the movement touches: the source of an expense, the destination of an
  income. Naming the source of an income left the line saying "Unknown account";
- the chips and the "Other" picker offer **the categories of that type**. Offering expense categories
  to an income is what made the server answer `CATEGORY_TYPE_MISMATCH` on save, with no way out of the
  card.

An **adjustment** is the one movement that can carry no category at all, so a card for one shows no
chips and no picker — only its description and "Open full form". Nothing the product does puts one
here: the server refuses an `ADJUSTMENT` at the quick endpoint.

The screen's copy names them **entries**, not expenses, for the same reason: "Save n entries?",
"n entries saved", and in the list's filters "Only what is still to review", which no longer echoes
"Only quick entries" next to it. Only the alert still names expenses, and only for the half of the
sentence that is about budgets, which is true of expenses alone.

**Save all** (`#save-all-confirmation`): a pinned footer button, "Save all · n", saves every card that
already has a category in one pass, each with its own category and description. It confirms in a sheet,
"Save n entries?" ("Each one keeps the category and description it has right now." plus "k stay pending
because they have no category yet."), with the call to action "Save n". The semantics are per item: the
saved ones disappear, the one that fails keeps its error on its card; toasts read "n entries saved" and
"n saved · m with errors".

**A category the server dropped** (`#dropped-category`): if the expense was saved **without** its
category because it had been archived on another device while this one had no connection, the card
carries a `warning` alert, "Its category had been archived, so the server saved it without one. Pick
another." The notice goes away with the card.
