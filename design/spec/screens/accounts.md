# Accounts

`preview/accounts.html`

## List (`#list`)

A summary card (the total balance of active accounts, active and archived counts, card debt as the sum
of negative balances of CARD, OVERDRAFT and LOAN — **this stat is pending T-85**, which replaces it with
the same split Home takes), then an `acct-grid` of one, two or three columns.
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

Name (a 409 becomes an inline error with the case-insensitive explanation), type, colour (swatches; a new
account opens on one of the 16 drawn at random — see [color.md](../color.md)),
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

## The accounts that are debt are an open question (T-85)

Nothing in this section is settled, and **nothing is built until the owner chooses**. The alternatives
are drawn in `preview/variants.html` and marked "Waiting on you"; the account detail with the whole
reading in place is in `preview/in-review.html#account-detail-as-debt`.

What he asked, on 2026-09-16: "actualmente las uso en positivo osea si mi tarjeta de credito tiene un
cupo de 100 estoy poniendo el balance de 100. por lo que un expense lo baja y un income o transffer lo
sube. pero eso hace que no pueda reflejar la deuda real y hace que la matematica del total balance
este inflada con dinero que realmente no es mio."

**The premise, which is not one of the questions.** A debt account already carries a negative balance:
an expense on a card lowers it, `summarizeAccounts` already adds a "Card debt" from the negative
balances of CARD, OVERDRAFT and LOAN, and this page has drawn Visa Gold at −$1,245,900 since the design
was written. So the sign is not up for decision — changing it would rewrite what every transaction
already recorded means. What is missing is a limit to measure against, a reading that says _debt_ in
words rather than in a minus sign, a total that shows its two halves, and a way to pay.

**The four questions this page owns.** A plate marked "Waiting on you" is an answer to choose; one
marked "Not chosen" is drawn as the baseline the others are read against, ruled out by his own sentence
or by the task card and not by anyone's taste, and it stays a word away from being chosen anyway.

| Question                                             | Waiting on you                                                          | Drawn, not chosen          |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| What a card or a loan leads with                     | `#debt-owed-first`, `#debt-available-first`                             | `#debt-signed-balance`     |
| What a debt account shows before you give it a limit | `#debt-no-limit-quiet`, `#debt-no-limit-prompt`                         | —                          |
| What an account gains besides its balance            | `#account-fields-a-credit-limit`, `#account-fields-the-amount-borrowed` | `#account-fields-per-type` |
| What the Pay button opens                            | `#pay-a-sheet-on-the-account`, `#pay-the-full-transfer-form`            | —                          |

**Four drafts go with them**, in `preview/in-review.html`: `#account-detail-as-debt` (the card's own
screen with the whole reading), `#loan-detail-and-pay` (the loan half of "pagar la tarjeta o el
préstamo", where the full-balance preset is the one part that reads wrong and the instalment is where
T-86's capital/interest split lands), `#debt-in-credit` and `#account-create-a-debt`.

**Two rules the drafts settle, because they are not choices.** A debt account whose balance is zero or
above **owes nothing**: it reads `$0 owed` with an empty bar and the money on it named as the account
holder's own. That covers an overdraft in its ordinary state, an overpaid card, and — until T-90 runs —
**every card in the product**. And on a CARD, an OVERDRAFT or a LOAN the create form's amount field asks
_How much do you owe on it right now?_ rather than _Current balance_, entered positive and stored as the
debt: that field is where the habit T-90 has to repair actually starts.

Every plate adds a **Car loan** to the four accounts this preview has always drawn, because a card and
a loan are not read the same way and one screen has to hold both: $12,504,500 across the three accounts
that hold money, $9,645,900 owed between the card and the loan, so the total is $2,858,600. Each note
carries what its answer costs. Two couplings are worth knowing before choosing: the loan's second line
says _paid of $12,000,000_ only if the form gains the amount borrowed, and _paid since you added it_
otherwise; and "what you have left" has no meaning on a loan, so choosing it splits the three debt
types into two readings. The bar means the same thing on both kinds — **the debt that is left** — and
the line under it is the part that is not owed, which is why a card says _left_ and a loan says _paid_.

**One thing the reading does not fix, and it is worth seeing before choosing.** Inside the account the
movements keep the account's point of view while the headline takes the owner's: an expense on the card
prints as `−$18,400` under a headline that reads _$1,245,900 owed_, and that expense _raises_ what is
owed. It is drawn that way in `#account-detail-as-debt`.

**Adjust balance is where a balance adjustment is made**, once Adjustment leaves the Add form — see
[add.md](add.md). Where an existing one is _edited_ is the fifth question, drawn on the same page.
