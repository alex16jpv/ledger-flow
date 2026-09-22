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
list reloads from the start with the toast "List updated". The export action is visible and inactive
("soon").

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

## Detail (`#detail`)

A centred hero (lg tile, amount, description, type · account), a table of attributes (category,
account or accounts, the long date, tags, note, source, currency), the actions Edit (the form,
preloaded) and Delete (confirmed in a sheet; a soft `DELETE`; a toast without undo, because there is no
restore), and a footer with created and edited.

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
cases the metadata adds "Saved on this device".

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
