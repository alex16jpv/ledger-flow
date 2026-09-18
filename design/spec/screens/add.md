# Add

`preview/add.html`

## Quick capture (`#quick-capture`)

**The sheet records all three types.** A three-way `segment` — Expense · Income · Transfer, the same
control the full form has minus Adjustment — sits at the top, above the amount, and the title is "Add"
rather than "Add expense" (owner's choice of 2026-09-15; the alternative, the title as a menu, stays
drawn in `preview/variants.html`). The type reconfigures what is underneath and never clears the
amount:

- **Expense** — the amount in `--text`, the category chips of the expense categories, one account row
  reading "From your main account".
- **Income** — the amount in `--income`, the income categories, and the account row reads "Into your
  main account".
- **Transfer** — From and To with the swap button between them, the amount in `--transfer`, the check
  that the two accounts differ, and the category row the other two types have, filtered to the
  TRANSFER type and optional (T-86): the sheet hands its state to the full form, where that field
  exists, so a category chosen here is not lost on the way.

`POST /transactions/quick` already accepts `type` (INCOME, EXPENSE, TRANSFER) and both account ids, and
the offline queue already applies the same per-type defaults, so this costs no sync work.

**The bar on top of the sheet opens the full form.** It is 44×4 here, not the decorative 36×4 of every
other sheet, and it is a real control: dragging it up **or tapping it** turns quick add into "New
transaction" carrying the amount, the type, the category and the note already entered — the same jump
the "More details" button makes, so the gesture is a shortcut and never the only way (owner's choice
of 2026-09-15). Its accessible name is "Open the full form"; at 4px tall it cannot be the only way in,
which is why the button stays. Dismissing the sheet is a tap outside it, ESC or the close button, not
the bar. The two alternatives — taking the bar out of every sheet, and turning it into
drag-to-dismiss — stay drawn in `preview/variants.html`.

A sheet: the amount focused with the numeric keyboard open; a row of chips with the five most used
categories plus "More", which opens the full picker; an account picker preselected with the main
account (with no main account, `NO_DEFAULT_ACCOUNT` → an empty, required picker); a quick note; and the
buttons "More details" (which carries the state into the full form) and "Save".

Saving posts to `/transactions/quick` with a UUID `Idempotency-Key` per distinct payload
(`IdempotencyKeyring`): a retry of the same amount, category and account reuses the key, and an
edited one gets a new key, which is what makes a lost reply safe to repeat. The note is not part of
that payload — it travels in the `PUT` that completes the movement. When a
category was chosen it is sent as `categoryId` — the backend still marks `pendingDetails`, and the app
may complete it with `PUT … pendingDetails:false` if the user gave both a category and a note. On save
the sheet closes, a toast says "Transaction saved · Undo" (undo is a `DELETE`), the amount clears and
the sheet is ready for another one if the FAB is held down.

## Pickers (`#category-picker`, `#account-picker`)

The category picker opens a sheet with search, a "Recent" row (the three most used), a list of rows
with tile, name and type, a check on the selected one, and a final "New category" row that creates one
inline — name, icon and colour at a minimum — without leaving the form. It filters by the transaction's
type.

The account picker lists active accounts with their type tile, name, Main badge, type and balance; in a
transfer the second picker excludes the account already chosen. Both are `role="dialog"`, close on
selection and return focus to the picker.

## Full form (`#full-form-expense`, `#full-form-transfer`)

A segmented control for the type (expense, income, transfer — adjustment left this form with T-85,
below) that reconfigures the form without losing the amount; the amount; the category, filtered to the
transaction's type and **optional on a transfer** (T-86, below); the account (expense: source; income: destination; transfer: from and to, with a swap button
and a check that they differ); the date and time (today by default; picking a day
sends local noon; more than 24 hours ahead returns `FUTURE_DATE` inline) **with the app's own calendar
and wheel, not the browser's** (`#date-sheet`, `#time-sheet`): the field opens the "Date" sheet with
the "Today" and "Yesterday" chips and the month's calendar, and the "Time" sheet with the wheel and
"Now"; a footer reads "Saved in your time zone, America/Bogota." and, under the calendar, "Days after
tomorrow are not available: the server refuses dates more than 24 hours ahead."

The same components serve the range in the filters sheet, and "Effective from" and the CUSTOM period of
a budget.

**If the device's clock runs ahead** of the `serverTime` that `POST /sync` returns by more than an
hour, the form warns under the date with a `warning` alert: "This device's clock is 3 days ahead of the
server. Dates more than 24 hours in the future will be refused." That is the preventive half of the
impossible-date problem; the corrective half lives in the attention tray.

Then: description; tags as chips with suggestions from `GET /transactions/tags` (lowercased when
shown); and a note. Saving carries an `Idempotency-Key`, and errors are shown by `code` next to the
field responsible (`CATEGORY_TYPE_MISMATCH`, `CATEGORY_ARCHIVED`, `AMOUNT_PRECISION`,
`CURRENCY_MISMATCH`). Editing uses the same form under the title "Edit transaction", with "Delete" as
the secondary action (confirmed; there is no restore).

## Adjustment leaves this form (T-85)

The segmented control presented four kinds as equals and they are not: an expense, an income and a
transfer are things that happened to your money, and an adjustment is the tool that repairs a balance
that has drifted. It moves to **Adjust balance** inside the account (see
[accounts.md](accounts.md)), which already preloads the recorded balance and already explains the
difference it is about to write; the segment here drops to three, which is what `#full-form-expense` and `#full-form-transfer` now
draw.

**An adjustment is also edited there** (`#adjustment-edited-in-the-account`, his choice of 2026-09-17:
since it is not in the transaction form, the alternative makes no sense). Tapping the row — in the
account's list or in the global one, which has no account context — reopens that sheet on that
adjustment, with Delete beside Save. **The sheet has two modes and they ask different questions.**
Creating asks _what is the real balance now_ and computes the difference; editing works on the
adjustment's **own amount**, because recomputing a past adjustment from today's balance would silently
change what it meant. The editing mode says so: _Recorded on Sep 21, it took −$12,300 off Bancolombia.
Changing the amount rewrites that difference, not today's balance._

`#adjustment-edit-keeps-the-fourth-type` — leaving the fourth kind on the Edit transaction form with
the other three disabled — stays drawn as the record of why not.

## Registering a movement (T-86)

Five questions were drawn more than one way and he answered all five on 2026-09-17. What follows is
the rule; the answers not taken stay on [`preview/variants.html`](../../preview/variants.html) as the
record of why, and every row is in [decisions.md](../decisions.md).

**Where this came from.** Someone he was shown the app by did not understand Transfer. Across the whole
product **there was not one sentence saying what a transfer is for**: four mention it and all four are
negations (`stats.transfersNote`, `stats.emptyTransfers`, `budgets.list.footnote`,
`budgets.form.categoriesHelp`), plus six labels. The asymmetry ran backwards: **Adjustment, the rarest
of the four types, was the only one with an explanatory line** (`transactions.form.adjustmentHint`).

### A line for each type, and a ? for the detail (`#transfer-said-for-every-type`, `#transfer-said-in-a-sheet`)

Under the segment, **one line for whichever type is selected** — his words: «la línea para los tres» —
**and a `?` beside it** that opens the three explained side by side («adicional me gustaría el botón de
? para que se abra el modal con la información más detallada de qué hace cada tipo de transacción»).
The two were drawn as alternatives and he took both.

- **Expense** — "Money leaving one of your accounts and not coming back."
- **Income** — "Money arriving into one of your accounts."
- **Transfer** — "Moves money between two of your own accounts: paying a card, a loan instalment,
  putting money aside. Nothing is spent and nothing is earned."

The sheet is three rows, each a tile, a name and its line. **They explain and lead nowhere, so they
carry no chevron.** The `?` has the accessible name "What the three types mean".

**Measured on the built plates, per type.** On a phone: Income 17px (one line), Expense 35px (two),
Transfer 52px (three). On a desktop: 17, 17 and 35. **The rule binds both surfaces**, Quick capture and the full form
(`#transfer-said-in-a-line-on-the-quick-sheet`): a rule that reaches one and not the other is how the
same thing comes to read two ways one tap apart.

### The form reads the movement back as a difference (`#readback-the-two-sides`)

Once both accounts are chosen: **"Bancolombia −$500,000 · Visa Gold $500,000 less owed. Your total
balance does not change."** His words: «la diferencia». The debt side is said in the T-85 vocabulary,
never as "+$500,000", because on a card more is not better.

**Each side is said in the vocabulary of the account it names**, which is what makes the sentence
general enough to cover every transfer and not only paying a card (`#full-form-transfer-plain`):

| The side is                      | Money leaves it                | Money arrives at it            |
| -------------------------------- | ------------------------------ | ------------------------------ |
| an ordinary account              | "Bancolombia −$300,000"        | "Savings +$300,000"            |
| a debt that owes something       | "Visa Gold $300,000 more owed" | "Visa Gold $300,000 less owed" |
| a debt holding money of your own | "Visa Gold −$300,000"          | "Visa Gold +$300,000"          |

A cash advance — money out of the card and into the bank — is the case the fourth cell exists for, and
it is why the debt side is never a sign while something is owed: on a card the direction and the good
news point opposite ways. **The last row is not a corner case today**: a card reads that way until its
owner has recorded what it owes, which is what the one-off script of T-90 repairs, so it is the state
every card in the product is in. Saying "less owed" about a card that owes nothing would contradict
the account's own card one screen away, which says _$100,000 of your own money sitting on it_. Which
row applies is the sign the whole product already reads — negative is a debt — so the sentence still
computes nothing. The sentence appears only when the amount and both accounts are there; before that there is
nothing to read back.

**It costs nothing but the sentence.** It repeats the amount just typed and the two names just picked —
no arithmetic on any balance — so house rule 4 is untouched and it reads identically offline, on a
device that has never seen those balances. The alternative, reading back what each account **will say
afterwards**, is the client computing money: only `lib/local/derive` may, and it must carry the
projection mark of [components.md](../components.md) 24. It stays drawn in
`#readback-with-the-new-balances` as the shape to return to if "will I be short?" becomes worth paying
for.

**This grammar is the product's, not this form's.** The Pay sheet approved in T-85 read back the
resulting balance ("Visa Gold goes to $0 owed"); it now says **"$1,245,900 less owed"** (see
[accounts.md](accounts.md)). One grammar, every surface.

### Three intent chips fill the two sides (`#transfer-by-intention-three-chips`)

Above _From_ and _To_, under the label "What are you doing?": **Pay a card · Pay a loan · Move to
savings**. A chip **saves nothing and adds no field** — it fills the two sides in the right direction,
which is the only thing people get wrong, because paying a debt means sending money **towards** the
card. _Pay a card_ puts the main account in _From_ and the card in _To_; with more than one card it
opens the account picker already filtered to cards. Everything stays editable afterwards.

**A chip nobody can use is not drawn.** Each one names a kind of account — a card or an overdraft, a
loan, a savings account — so with none of that kind there is nothing for it to fill and it does not
appear; with several it opens the picker filtered to them. On the seeded account set that means two
chips, not three.

**A chip does not touch the category.** Preselecting one would be the chip setting a field, which is
not what it was described as when he chose it, and on a loan there is no seeded category to preselect:
the backend seeds only _Transfer_ and _Credit Card Payment_.

**T-85's Pay sheet does not go away**: it stays the way in from the account, and this is the way in for
someone who starts at the ＋. Two ways to record the same transfer is the cost he accepted, so they
**share the pickers, the `Idempotency-Key` and the offline queue** rather than each growing its own.

### A transfer can carry a category (`#transfer-categories-used`)

The transfer form and the Pay sheet carry an **optional** category in the same slot expense and income
use, filtered to the TRANSFER type. His word: «usarlas».

Before this, **every user was seeded with two Transfer categories** — _Transfer_ and _Credit Card
Payment_ (`src/shared/defaultCategories.ts:74-88`), two of the ten a new account starts with — the
Categories screen counted them in a tab of their own, and **no form could attach one to anything**:
`categoryAllowed()` is true only for Expense and Income (`features/transactions/form.ts:65`), the
mappers null the category on every other type (`form.ts:120`, `:164`), and the form clears and hides the
field on switching type (`TransactionForm.tsx:133`, `:178`). **The server was never the obstacle:** it
refuses a category only when its type and the transaction's differ (`TransactionService.ts:408`), and
`/stats/spending` already groups transfers by category. What it buys is drawn in
`#transfer-categories-in-the-list`.

### A loan instalment stays one movement (`#instalment-one-movement`)

His words: «por ahora prefiero sin el campo de interés. tengo que pensarlo más a futuro cómo hacerlo.»
So the Pay sheet keeps its single movement, its two presets and its optional category: no interest
field, no second movement, nothing new on the server. **And no instalment preset**: T-85 had already
worked out that a _This month's payment_ preset needs a figure the account does not have
(`#loan-detail-and-pay`), so where that figure would come from is part of what T-94 has to settle, not
something to invent here.

**What stays wrong is written down, not forgotten.** About $126,000 of a $420,000 instalment is
interest, so the loan falls by the whole $420,000 when only $294,000 paid it down: the bar that says
_what is paid_ runs ahead by the interest for the life of the loan, and the interest never appears in
Stats, because a transfer is not spending. That is **T-94** on his list, deferred by him, with both
answers already drawn and measured — `#instalment-two-movements` (with its half-applied state,
`#instalment-only-half-arrived`) and `#instalment-interest-inside-the-movement`.

## What the form may offer, by type of account (T-93)

His words, 2026-09-17: "si hacer un income sobre una tarjeta es incorrecto entonces no se debe de
permitir. ese es el caso especifico pero ahi que revisar que otros casos asi no deberian de
presentarse". **The rule is the server's** — the whole grid of movement type against account type is
reviewed and enforced there, because this client is not to be trusted with it. What belongs here is
the other half: **not offering what the server will refuse, and saying why when it refuses anyway.**

**On Income the account picker leaves out a card and a loan**
(`#income-picks-only-money-accounts`), and the sheet's note says why in the product's own words:
_money arriving at a card or a loan is a payment, not income_. Hiding them without a word would leave
someone hunting for their Visa; the note is the same place the picker already explains _Somewhere
else_.

**An overdraft stays on the list**, and it is the one debt type that does — his decision of
2026-09-18, asked while this was built. T-101 settled that a positive balance is an overdraft's
**ordinary** state: it is the account that holds the money and sometimes dips below zero, so a salary
landing there is income, and refusing it would take that salary out of _Income this month_. A card and
a loan have no such reading.

**Switching the type to Income clears an account that is debt**, exactly as it already clears a
category that belongs to another type. Nothing is silently carried into a shape the server refuses.

**The quick capture follows the same rule**, and it has one case of its own: when the **main account
is a card** — which is allowed, and a quick expense on it is the most ordinary purchase there is — an
income cannot land there by default. The picker opens empty and asks for an account instead of
sending the main one to be refused.

**Expense and Transfer offer everything**, and that is deliberate: spending with a card is what a
card is for, paying one is the movement the Pay sheet exists for, and a cash advance out of a card is
real.

**A transfer cannot pay a loan more than it owes.** The Pay sheet already capped it; the full form
does too, on the amount, with the figure in the message. It is not only a round trip saved: without a
network the mirror would draw the loan paid off and only the attention tray would take it back later,
and that is the one thing offline is not allowed to do.

**When the server refuses anyway** — a movement queued offline before this shipped, another device, an
older app — `INCOME_ON_CARD_OR_LOAN` and `LOAN_OVERPAID` are shown **as the form's own alert**, at the
top, with the sentence that says what to record instead. Never a toast: the form is where the wrong
choice was made. They are not placed on a single field because the server does not say which one is
wrong, and a guessed field would point at the wrong half of a transfer.

### What was premise, and was not asked

- **Adjustment has already left this form** — T-85's decision (above).
- **The type stays a segmented control**, his choice of 2026-09-15.
- **The interest split, when it happens, belongs to the Pay sheet**, the only place the app knows a
  movement is a loan instalment. An instalment typed by hand into this form stays one transfer.

## Money from outside, in the transfer's _From_ (T-100)

His words, 2026-09-17: «lo del somewhere else en el account from Tambien tiene que aplicar en el
formulario de transaccion en transfer. y se debe de considerar en la tarea de las reglas de transfer
para definir si sale siempre o cuando se cumplan condiciones como por ejemplo que el TO sea una credit
card o un loan o algo en lo que realmente aplique».

**The row is the Pay sheet's, unchanged** (`#transfer-from-somewhere-else`): under the accounts of the
_From_ picker, `Somewhere else · not an account here`, with the note the sheet already carries. Same
row, same words, the same picker component — the two surfaces share it rather than each growing its own
(§8.14), and what it writes is the same one-sided ADJUSTMENT raising the debt account, with no category.
Why an adjustment and not an income is settled in [accounts.md](accounts.md) and does not change here:
the money is neither income nor spending, it simply never was inside the app.

### It appears only when the _To_ is a card or a loan (`#transfer-from-only-when-it-applies`)

That is the condition he asked to be defined, and it is not a new rule — it is T-93's, read from the
other side. Money arriving **from outside** at an account that holds money **is income**, which is what
the grid in `lag-money-manager/docs/modules/transactions.md` settled, so towards an ordinary account, a
savings account or an **overdraft** the honest record is an Income and this row has nothing to offer.
It is exactly the two types where an income is refused, for exactly that reason, so the app reads it
from the one list and does not keep a second copy of it (T-103 is about publishing that list in the
contract).

**Reaching it costs nothing extra.** The _To_ is one field below _From_, and the two intent chips that
fill a card or a loan set it in one tap; the row is in the picker from the moment the _To_ qualifies.
**Choosing a _To_ that does not qualify takes the row away**, and empties _From_ if that was the choice,
so the form asks for an account instead of carrying one that no longer means anything.

### It is not offered in the _To_

His decision, 2026-09-18, asked as part of this task. Money leaving towards something the app does not
track already has its shape: it is an **Expense**. A second way to record it that is not spending would
keep the same act out of Stats and out of every budget depending only on which field it was typed into.

### What the rest of the form does while it is chosen

- **The category disappears**, as it does in the Pay sheet: an adjustment carries none and the server
  refuses one.
- **The sentence at the bottom loses its left half**: _Visa Gold $500,000 less owed. It does not count
  as income or as spending, because the money never was in Ledger Flow._ There is no second side to
  name, and the side that is there is said in the same vocabulary the table above sets — a card
  holding money of its owner's takes a sign, not _less owed_ — so it is the Pay sheet's sentence
  built out of the product's grammar rather than a second copy of it.
- **The swap button is disabled.** One of the two sides is not an account, so there is nothing to swap
  it with, and the _To_ never takes this row.
- **The description is the user's if they typed one**, and the Pay sheet's — _Paid from outside Ledger
  Flow_ — if they did not, because the history would otherwise read _Balance adjustment_ about a
  payment.
- **The loan ceiling of T-93 still applies**, on the amount, exactly as it does for a transfer: the
  server caps an ADJUSTMENT into a loan on the same terms as a TRANSFER.

**Saved, it leaves this form for good.** An adjustment is not editable here — T-85 took the type out of
the form — so `/transactions/<id>/edit` sends it on to the detail, where it can be read and deleted.
That is already true of the Pay sheet's outside payment: it is the cost of the shape, not of this
screen.
