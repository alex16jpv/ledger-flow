# Budget detail

`preview/budget-detail.html`

## Detail (`#detail`)

Period navigation; a hero card (lg tile, the name, "{period type} · {range} · since {effectiveFrom}", an
"Adjusted" badge when `hasOverride`; spent as the headline over the limit; progress with the pace mark
and, **only here**, the fixed line "The mark is today's pace: 73% of the period has passed (day 22 of
30)." underneath; stats for what is left, the pace per day and the days remaining; for CUSTOM, "ends in
n days" or "Ended").

A card, "This period's amount", with the text of the base and the adjustment, and the actions "Change
adjustment" (a sheet with the amount → `PUT /budgets/:id/amount?reference=`), "Skip this month"
(`amount: 0`) and "Remove adjustment" (`DELETE …/amount?reference=`).

Categories as chips (the ones in `archivedCategoryIds` at 70% with an "archived" badge); a global budget
shows the chip "All spending". Then the note, the period's transactions (`?categoryId=…&from&to`, or
`?from&to` when global) with a link to the filtered list, and the actions Edit and Archive (confirmed,
with the footer "You can restore it later from Past budgets.").

**An archived budget** (`#archived`): a `neutral` alert on top — "This budget is archived and no longer
tracks spending. Restore it to bring it back exactly as it was." — with a "Restore" button
(`POST /budgets/:id/restore`). If another active budget occupies the same period and the same
categories, a `danger` sheet, **"Another budget is in the way"** (`#restore-blocked`), names it — "“X”
is active for the same {period} period and covers the same spending, so this one can't come back as it
was. Create a new budget instead." — and offers "Open X".

## New and edit (`#new-budget`)

Name; a segmented scope, "All spending" or "By category" (help: one global budget per period type);
multiple categories (EXPENSE only, up to 20; when editing, archived ones already present are kept); the
period (six chips; CUSTOM shows two date fields and checks that the start precedes the end); an alert
when the period or the dates change while editing, because that clears the adjustments; the amount; the
colour; and advanced options (effective from, with help, and a note). Errors: `BUDGET_PERIOD_OVERLAP`
as an alert naming the category in conflict, `CATEGORY_ARCHIVED` and `CATEGORY_TYPE_MISMATCH`.

## Past (`#past-budgets`)

A segmented control between Ended (`includeExpired`) and Archived (`includeArchived`); cards at 85% with
a status badge and "Create again", which opens the form preloaded; archived ones also offer "Restore".
A note says recurring budgets never end.
