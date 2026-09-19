# Sync conflicts

`preview/conflicts.html`

One sheet, **"Resolve sync conflict"**, reachable from "Review" on the red stripe, from a transaction's
detail, and from "Compare versions" in the attention tray. Its shape depends on what the server
answered.

Fields are named in plain language (Amount, Date, Description, Note, Tags, Category, From, To, Name,
Type, Colour, Icon, Initial balance, Credit limit, Currency, To review, Effective from, Period…), and
empty ones are shown as "—".

- **Changed in two places** (`#changed-in-two-places`, `STALE_UPDATE`): a `danger` alert, "Changed in
  two places. This {what} changed somewhere else while this device was offline. Choose the version to
  keep.", two comparison cards, "On the server" and "On this device", with the disputed field
  highlighted, a primary "Keep this device's version" and a ghost "Use the server's version".
- **The server did not say what it has** (`#server-did-not-say`): the same, plus a `warning` alert, "The
  server didn't say what it has. Keeping this device's version will overwrite it."
- **Refused by the server** (`#refused-by-the-server`, any other code): a `danger` alert, "The server
  refused this change. It was never applied, here or there. Reason: {code}. Discarding it puts this
  {what} back to what the server has.", this device's card (and the server's when it answered with a
  row, for instance whoever holds the name in a `DUPLICATE`), with "Discard this change" first and "Try
  again" after.
- **The name is taken** (`#name-taken`, an `account:restore` or `category:restore` refused with
  `DUPLICATE`): a `danger` alert, "**The name is taken.** An active {account|category} is already named
  “Cash”, so the server won't take this one back. Restore it with another name, or discard the change.",
  the two comparison cards — "On the server · has the name", built from the row the backend returns in
  `conflict.current`, and "On this device · being restored" — with `Name` highlighted, and **the rename
  sheet embedded right here**: a "New name" field preloaded with "{name} (old)", the help "Names are
  case-insensitive." and the primary call to action **"Restore as “Cash (old)”"**, which requeues the
  same operation with `payload.body.name` changed; "Discard this change" is the ghost. **"Try again" is
  not offered**: the same name would be refused again, and saying so keeps the user from trying — "“Try
  again” is not offered here: the same name would be refused again."
- **The account was archived elsewhere** (`#account-archived-elsewhere`, `RESOURCE_ARCHIVED`): a
  `danger` alert, "The account was archived somewhere else. This {what} uses an account that was
  archived on another device, so the server will not take it. Restore the account and it goes through in
  the same batch, or edit the {what} to use another account.", the account's name, a primary **"Restore
  the account"** — which queues the restore ahead of the transaction; if the device no longer holds the
  account, a `danger` toast says so — and "Discard this change".
- **Fix the date** (`#fix-the-date`, `FUTURE_DATE`): the sheet changes its title to **"Fix the date"**
  and its way out — until now it could only be discarded. A `danger` alert: "**The server refused this
  date.** Sep 25 · 18:10 is more than 24 hours ahead of the server's time (Sep 22 · 18:12). This
  device's clock is 3 days ahead." The drift comes from comparing the local clock with the `serverTime`
  that `POST /sync` returns, and with no drift that last sentence is not painted. Then the **Date** and
  **Time** fields preloaded with the server's time, the help "Was Sep 25" under the date, and the
  transaction's own row so the user knows which one it is. The ways out are "**Save and try again**"
  (primary; it requeues the same operation with the corrected date), "Discard this change" (ghost), and
  the footer "1 more change is waiting behind this one." when the refused operation is a creation that
  holds others back.
- **Nothing left to resolve** (`#nothing-to-resolve`): a `success` alert, "This change is no longer
  waiting to sync.", with a Close button — for when another tab resolved it first. While it opens, the
  sheet says "Reading what's waiting…". **In this state the sheet closes on the first try** (T-109):
  a name or a date typed into the comparison belongs to a conflict that is no longer there, so asking
  "are you sure you want to leave?" would be asking about work that cannot be saved anyway.
