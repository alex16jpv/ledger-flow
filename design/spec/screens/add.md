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
- **Transfer** — no category at all: From and To with the swap button between them, the amount in
  `--transfer`, and the check that the two accounts differ.

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

A segmented control for the type (expense, income, transfer — adjustment left it with T-85, below)
that reconfigures the form
without losing the amount; the amount; the category (expense and income only, filtered by type, never a
TRANSFER category — which is one of T-86's open questions, below); the account (expense: source; income: destination; transfer: from and to, with a
swap button and a check that they differ; adjustment: one account plus an "increase / decrease" segment
that decides `toAccountId` or `fromAccountId`); the date and time (today by default; picking a day
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

## Registering a movement (T-86) — drawn, waiting on a choice

Nothing in this section is decided. Every answer is drawn on
[`preview/variants.html`](../../preview/variants.html) and listed on **Waiting on you**; when one is
chosen it comes back here as the rule and the rest stay there as the record.

**The measurement this came from.** Someone he showed the app to did not understand Transfer. Across
the whole product, on 2026-09-16, **there is not one sentence that says what a transfer is for**: the
only two that mention it are negations — "Transfers between your own accounts are not spending" and
"Balance adjustments and transfers never count toward a budget" — plus four labels. The asymmetry runs
backwards: **Adjustment, the rarest of the four, is the only type with an explanatory line**
(`transactions.form.adjustmentHint`). And the form asks _geometry_ — From and To — when the person has
an _intention_ ("I paid the card"), on the one operation where the direction is counter-intuitive:
paying a debt means sending money **towards** the card.

**What is premise here, and was not asked.** Adjustment has already left this form — that is T-85's
decision, not a question (see above). The type stays a segmented control, his choice of 2026-09-15.
And **whatever is decided binds both surfaces**, Quick capture and the full form: a rule that reaches
one and not the other is how the same thing comes to read two ways one tap apart.

### The five questions

| What is being asked                             | Drawn as                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| How the form says what a transfer is            | `#transfer-said-in-a-line` (+ the same line on the quick sheet), `#transfer-said-for-every-type`, `#transfer-said-in-a-sheet` |
| What the form reads back before you save        | `#readback-the-two-sides`, `#readback-with-the-new-balances`, `#readback-nothing`                                             |
| Whether Add keeps a way in by intention         | `#transfer-by-intention-three-chips`, `#transfer-by-intention-one-chip`, `#transfer-by-intention-none`                        |
| How a loan instalment records its interest      | `#instalment-one-movement`, `#instalment-two-movements`, `#instalment-interest-inside-the-movement`                           |
| What happens to the categories of type Transfer | `#transfer-categories-used`, `#transfer-categories-dropped`                                                                   |

**The read-back is where the line is drawn between a sentence and a projection.** Saying _Bancolombia
−$500,000 · Visa Gold $500,000 less owed, your total does not change_ repeats the amount just typed and
the two names just picked: no arithmetic on a balance, so house rule 4 is untouched and it reads the
same offline. Saying what each account **will read afterwards** is the client doing money arithmetic,
which only `lib/local/derive` may do and which has to be painted as a projection — offline, a
projection of a projection.

**The instalment is the one that can reach the server.** The Car loan owes $8,400,000 of $12,000,000
and its instalment is $420,000, of which about $126,000 is interest. Recorded as one transfer — what
happens today — the loan falls by the whole $420,000 when only $294,000 paid it down, so the bar that
says _what is paid_ runs ahead by the interest every month, and the $126,000 actually spent never
appears in Stats. Writing the transfer and the interest as **two movements** needs nothing new from the
server, but they are **not atomic**: `POST /sync` applies its operations one at a time through the same
services (`SyncBatchService.applyOne`), so offline one can be applied and the other rejected. Carrying
the interest **inside one movement** removes that, and is a new shape in the domain — a field on
`Transaction`, the OpenAPI, `/stats/spending`, `lib/local/derive/spending.ts` and the parity fixtures
that prove those two agree. Only that third answer is a backend task, and if it is chosen it is T-87.

**The Transfer categories are worse than "unused".** Every user is seeded with two of them — _Transfer_
and _Credit Card Payment_ (`src/shared/defaultCategories.ts:74-88`) — the Categories screen counts them
in a tab of their own, and no form can attach one to anything: `categoryAllowed()` is true only for
Expense and Income (`features/transactions/form.ts:64`) and `withType()` nulls the category on every
other type. The server is not the obstacle: it refuses a category only when its type and the
transaction's differ (`TransactionService.ts:407`). So either the transfer form gains the optional
category it already has a contract for, or the type comes off the screen.
