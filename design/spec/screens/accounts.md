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

### On an account that is debt (`#adjust-balance-on-a-debt`, T-95)

On a CARD, an OVERDRAFT or a LOAN the same sheet **asks the debt**, not the balance with its sign.
His decision, 2026-09-17, asked as "ajustar el balance en una credit card que sería? el cupo
disponible para usar? o la deuda?" and answered **la deuda** — which is what the rest of the product
already does: the account form asks _How much do you owe on it right now?_
(`#account-create-a-debt`), the card leads with what is available and says `$1,245,900 owed of
$4,000,000`, and Pay this card works on what is owed. The available credit is derived, never typed.

So the sheet drops the **Positive / Negative** segment, which on a debt account says nothing, and
puts in its place **what the amount is**: `Owed` or `Your own money`. The second is not an edge case
to tolerate — **an overdraft sitting positive is its ordinary state** (`#debt-in-credit`), a card can
be overpaid, and every card in the product is in that state until T-90 runs. Dropping the control
outright would make those balances unsayable on the one screen whose job is to say them.

**The question follows the segment**, so the label can never contradict the answer: `Owed` asks _How
much do you owe on {name} right now?_, `Your own money` asks _How much of your own money is on {name}
right now?_. It opens on whichever the recorded balance already is, with that figure preloaded — a
card that owes nothing opens on `Your own money`.

The line under it reads the recorded state in the same words the rest of the product uses:
`Recorded: $1,245,900 owed`, or `Recorded: $4,000,000 of your own money on it`. And the alert reads
the difference as the product's debt grammar, the one [add.md](add.md) fixed: **`$12,300 less owed`**
/ **`$12,300 more owed`**, followed by the same tail as ever — it counts neither as spending nor in
budgets.

Everything below is untouched: the note, the zero-delta rule, and the write itself. What reaches the
server is exactly what reached it before — an ADJUSTMENT with `fromAccountId` when the balance goes
down and `toAccountId` when it goes up — because this decision is about the question, not about the
money. **Editing an adjustment that already exists is not this sheet** and does not change: it works
on the adjustment's own amount with Increase/Decrease.

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

## The accounts that are debt (T-85)

His words, 2026-09-16: "actualmente las uso en positivo osea si mi tarjeta de credito tiene un cupo de
100 estoy poniendo el balance de 100 … eso hace que no pueda reflejar la deuda real y hace que la
matematica del total balance este inflada con dinero que realmente no es mio." The alternatives are
drawn in `preview/variants.html`; what he chose on **2026-09-17** is below, every question is
answered, and the rows are in [decisions.md](../decisions.md). Nothing is built yet.

**The premise, which was never a question.** A debt account already carries a negative balance: an
expense on a card lowers it, `summarizeAccounts` already adds a "Card debt" from the negative balances
of CARD, OVERDRAFT and LOAN, and this page has drawn Visa Gold at −$1,245,900 since the design was
written. Changing the sign would rewrite what every recorded transaction means.

### What a debt account leads with (`#debt-available-first`)

**A CARD or an OVERDRAFT leads with what is still available** — `$2,754,100 available` — with the debt
on the line under the bar: `$1,245,900 owed of $4,000,000`. His reason, and it is the one card apps
follow: the figure you want in a shop is how much room is left. **A LOAN leads with what is owed,**
because a loan has nothing available; its second line says how much of it is paid. So the rule is per
type, and it is not an inconsistency: each type leads with the figure it actually has.

**The two bars do not fill for the same reason, and that is settled** (`#debt-bar-how-it-moves`). On a
**card** the bar is **the limit in use**: a purchase pushes it up, a payment pulls it back down, and at
$0 owed it is empty with the whole limit available again. On a **loan** it is **what you have paid
off**: it only ever grows, because you cannot re-borrow what you repaid, and it is full the day the
loan is finished. The line under each says which it is, so the bar is never read alone. That line always describes what the bar **fills with**, never its complement, and `npm run design:check` compares the two on every bar of every plate — the mismatch shipped three times before it was checked by arithmetic instead of by eye. The cost is
real and accepted: a card at 31% and a loan at 30% mean different things on the same list. The
alternative — one rule for both, the bar always being the debt that is left — makes a loan start full
and empty as you pay, which reads backwards.

**A debt account that owes nothing reads so** (`#debt-in-credit`). A card with a limit and **exactly
zero** owed still leads with its availability — `$4,000,000 available`, `$0 owed of $4,000,000`, empty
bar. Only a balance on the owner's side of zero — an overpaid card, an overdraft in its ordinary state
— reads `$0 owed` with the money on it named as the holder's own. That covers an overdraft in its
ordinary state, an overpaid card, and — until T-90 runs — every card in the product.

**And on day one none of them carries the field either**, so that is what the plate draws: `$0 owed`, the
money named as the holder's own, **no bar** — a bar needs a scale and there is none — and the prompt still
asking for the limit. The bar arrives with the field, not with the debt.

**What it costs, and it is paid knowingly.** The figure on screen is the opposite sign of the one the
server stores, so every surface that paints a balance has to know the account's type, offline
projections included. **Those surfaces are four**, and they read the account the same way or the
product says it two ways: the card in this list, Home's carousel, the account's own screen, and the
account picker — where the row carries the word beside the type, because a figure with no word there
reads as a balance. And inside the account the movements keep the account's point of view while the
headline takes the owner's: an expense on the card prints as `−$18,400` under a headline about what is
available, and that expense _reduces_ what is available. Drawn in `#account-detail-as-debt`.

### Before a limit is set (`#debt-no-limit-prompt`)

A debt account with the field of its type still empty carries a button on its card in the list, so the
field is discovered where the gap is. **The button names the field that type has**: a CARD or an
OVERDRAFT says **Set a credit limit**, a LOAN says **Set the amount borrowed** — a credit limit means
nothing on a loan. The card stays openable through a stretched link and the button sits on top of it,
which is **a second tab stop per card** — the same shape T-68 is open about for the sync icon, accepted
here on purpose. Without the field there is no bar and no second line.

### The two fields an account gains (`#account-fields-the-amount-borrowed`)

Two, both **optional**: **Credit limit** on CARD and OVERDRAFT, and **Amount borrowed** on LOAN. Every
other type's form is untouched. The amount borrowed exists because `openingBalance` — written once at
creation and never changed — is the balance the day the account was created, not what was borrowed, so
a loan someone starts tracking halfway through cannot say what its progress is a fraction of. A set of
terms per type (interest rate, monthly payment, payment day) was drawn and **rejected**
(`#account-fields-per-type`): nothing reads three of those four until T-86's instalment split exists.

**On creation the amount field asks for the debt** (`#account-create-a-debt`): on a CARD, an OVERDRAFT
or a LOAN it reads _How much do you owe on it right now?_ rather than _Current balance_, entered
positive and stored as the debt. That field is where the habit T-90 has to repair actually starts.

### The summary card

It takes the same shape Home does: **What you have** as the headline and **What you owe** beside it,
and **no net figure** — see [home.md](home.md) for why. The "Card debt" stat it carries today goes.

### Paying a debt (`#pay-a-sheet-on-the-account`, `#pay-from-outside-quiet`)

**Pay this card / Pay this loan** is one primary action above the four the detail already had, and it
opens **a sheet on the account**, not the transaction form: the amount preloaded with everything owed, a
chip to change it, one _From_ picker, an optional category and a line reading the result back. It is a
TRANSFER underneath with the direction filled in — paying a debt means sending money **towards** the
card, which is the step people get backwards. Underneath it must use the same pickers, the same
`Idempotency-Key` and the same offline queue as the transaction form, not a private copy (§8.14).

**Two things T-86 changed here, and they are his decisions, not tidying.** The sheet reads the result
back **as a difference** — "Bancolombia −$1,245,900 · Visa Gold **$1,245,900 less owed**", not "goes to
$0 owed" — because that grammar is now the product's on every surface (see [add.md](add.md)), and that
includes the _Somewhere else_ sheet, which is the same act on the same card. And the sheet carries the
same **optional TRANSFER category** the form now has, with nothing preselected, so a card payment can
say so. The presets stay the two it had: `#loan-detail-and-pay` is right that the instalment is the
ordinary payment on a loan, but a preset for it needs a figure the account does not carry, and that is
part of T-94.

**The instalment still records as one movement, and that is deliberate for now.** His words: «por ahora
prefiero sin el campo de interés». About $126,000 of a $420,000 instalment is interest, so the loan
falls by more than was actually paid off and the interest never reaches Stats — **T-94** on his list,
with both answers drawn in `#instalment-two-movements` and `#instalment-interest-inside-the-movement`.

**The _From_ picker carries one row under the accounts: `Somewhere else · not an account here`.** A debt
can be paid with money the app does not track — someone else's transfer, cash, an account the user
chose never to register — and nothing here loses that money, so it cannot be a transfer.

**It is not an account and nothing is created.** It never appears in Accounts, it has no balance, it
counts in no total, and the user registers nothing: that is the whole point, the money comes from
something they decided not to track. It is a row in a picker that writes a **one-sided ADJUSTMENT**
raising the debt account, a shape the product already has.

**Why an adjustment and not an income.** An income gets the balance right and then lies three times:
Home's _Income this month_ is `fetchSpending({type: "INCOME"})` over the month
(`features/home/hooks.ts:111`), _Estimated savings_ is income minus spending, and the product has income
budgets. `deriveSpending` excludes ADJUSTMENT from all three unless the query names it
(`lib/local/derive/spending.ts:107`), which is exactly right: the money is neither income nor spending,
it simply never was inside the app. The cost is that "adjustment" means _reconcile a balance_ everywhere
else, so the sheet writes the description for you. **And it is now a rule, not a preference:** if an
income on a debt account is wrong, the product should refuse it — T-93 sweeps the other combinations.
