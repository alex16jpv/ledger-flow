# Transactions

`preview/transactions.html`

## List (`#list`)

Search (on the client over the loaded page, plus a `tag` filter when it starts with `#`), a row of
chips — "Filters" with the count of active filters (it opens the filters sheet), the period (this month
by default), the type, "To review · n", "Uncategorized" and recent tags. A summary card for the period
(spent, income, number of transactions). The list is grouped by day, with a `day-head` carrying the
day's total, in the user's zone.

A row shows the category tile (or a neutral `hash` when there is none), the description or the
category's name or "Quick expense", the time · the account, and the amount signed by type; an
ADJUSTMENT carries an "Adjustment" badge and a `scale` tile; a QUICK entry still to detail carries an
amber background and its badge. Infinite scroll through `hasMore`/`nextCursor`; on `INVALID_CURSOR` the
list reloads from the start with the toast "List updated". The export action is visible and inactive
("soon").

## Filters (`#filters`)

Period with presets (this week, this month, last month, this year, custom) and two date fields; type
(all, expenses, income, transfers, explicit adjustments); account (chips with a tile); category (recent
chips plus "More", which opens the picker, plus "Uncategorized" = `uncategorized=true`); tag (`tag=`);
and the switches "Only quick expenses to review" (`pendingDetails=true`) and "Only quick entries"
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

An explanatory alert (the money already left the balance and already counts against the global budget),
then one card per quick add with the amount, the date · the account, chips of the most used categories
plus "Other" (the full picker), a description and "Done" (`PUT` with `categoryId`, `description`,
`pendingDetails: false`); "Open full form" leads to the form. After the last one, an empty state, "All
detailed", with a way back to Home.

**Save all** (`#save-all-confirmation`): a pinned footer button, "Save all · n", saves every card that
already has a category in one pass, each with its own category and description. It confirms in a sheet,
"Save n expenses?" ("Each one keeps the category and description it has right now." plus "k stay
pending because they have no category yet."), with the call to action "Save n". The semantics are per
item: the saved ones disappear, the one that fails keeps its error on its card; toasts read "n expenses
saved" and "n saved · m with errors".

**A category the server dropped** (`#dropped-category`): if the expense was saved **without** its
category because it had been archived on another device while this one had no connection, the card
carries a `warning` alert, "Its category had been archived, so the server saved it without one. Pick
another." The notice goes away with the card.
