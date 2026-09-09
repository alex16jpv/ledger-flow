# Add

`preview/add.html`

## Quick capture (`#quick-capture`)

A sheet: the amount focused with the numeric keyboard open; a row of chips with the five most used
categories plus "More", which opens the full picker; an account picker preselected with the main
account (with no main account, `NO_DEFAULT_ACCOUNT` → an empty, required picker); a quick note; and the
buttons "More details" (which carries the state into the full form) and "Save".

Saving posts to `/transactions/quick` with a UUID `Idempotency-Key` per opening of the sheet. When a
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

A segmented control for the type (expense, income, transfer, adjustment) that reconfigures the form
without losing the amount; the amount; the category (expense and income only, filtered by type, never a
TRANSFER category); the account (expense: source; income: destination; transfer: from and to, with a
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
