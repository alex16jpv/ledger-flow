# Accounts

`preview/accounts.html`

## List (`#list`)

A summary card (the total balance of active accounts, active and archived counts, card debt as the sum
of negative balances of CARD, OVERDRAFT and LOAN), then an `acct-grid` of one, two or three columns.
Each card carries a colour stripe, the type tile (a fixed icon per `type`), the name, the Main badge,
the balance and the type. A folded "Archived (n)" section asks for `includeArchived=true` when opened;
the contents of its cards sit at 60% with a badge, and the card's own box stays solid so the
focus ring is not dimmed with it.

## Detail (`#detail`)

A hero card with the stripe, the tile, the Main badge, the type, the name, the balance as the headline
and a line reading "Opening balance X · created on … · currency". A 2×2 grid of actions: Adjust
balance, Edit, Make main (disabled when it already is; pressing it opens a confirmation explaining that
the previous one stops being main and that quick expenses will go here), and Archive (when it is the
main account, disabled with the `DEFAULT_ACCOUNT_ARCHIVE_BLOCKED` explanation; otherwise a
confirmation; once archived, the button becomes Restore, and a 409 on restore opens the **"That name is
taken"** sheet (`#restore-with-another-name`), which asks for the new name and restores with it in one
step). Below, the account's transactions (`?accountId=`) grouped by day, with a link to the filtered
list.

## Adjust balance (`#adjust-balance`)

The amount is the real balance, preloaded with the current one; "Recorded balance: X"; an alert with
the computed delta and its sign ("An adjustment of −12,300 will be created"); an optional note; and
"Save adjustment" → `POST /transactions` of type ADJUSTMENT, with `fromAccountId` when it goes down and
`toAccountId` when it goes up. A delta of zero disables the button.

## New and edit (`#duplicate-name`)

Name (a 409 becomes an inline error with the case-insensitive explanation), type, colour (swatches),
the current balance only when creating, and a preview card. `ACCOUNT_LIMIT_REACHED` shows as an alert
above the button.

## The type picker (`#account-type-sheet`)

One `picker` row that shows the chosen type with its description ("Cash · notes and coins you carry")
and opens a sheet with the nine types, each with a line that explains it. It **replaces the grid of
nine chips over several lines** and is used **the same way in the account form and in onboarding**, so
there are not two ways of choosing the same thing. The two discarded alternatives — a scrolling row of
nine chips, and five essentials plus "More" — stay drawn in `preview/variants.html` with the reason.

The descriptions: Cash "Notes and coins you carry" / ES «Billetes y monedas que llevas encima» · Bank
account "A checking or current account" / «Una cuenta corriente o de ahorros del banco» · Credit card
"Spending you pay back later" / «Gasto que pagas después» · Debit card "Tied to a bank account" /
«Ligada a una cuenta del banco» · Savings "Money you keep aside" / «Dinero que apartas» · Investment
"Funds, stocks, crypto" / «Fondos, acciones, cripto» · Overdraft "A negative balance you can use" / «Un
saldo en negativo que puedes usar» · Loan "Money you owe" / «Dinero que debes» · Other "Anything else" /
«Cualquier otra cosa».
