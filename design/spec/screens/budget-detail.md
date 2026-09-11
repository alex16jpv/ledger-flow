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
shows the chip "All spending". Then the note.

## What the period is doing (`#detail-with-charts`)

Four cards between the note and the transactions. A budget's detail used to say what had been spent and
how much was left; these say **how it got there and where it is going**, which is the only thing that can
still be acted on.

- **Spending per day**: the same `Bars` Home has, over the budget's own period instead of the month —
  same tooltip, same `readout`, same rule for the days that have not arrived — and a bar opens that day's
  transactions, filtered to the budget's category where the backend can filter by one (see below).
- **Against the pace** (`trend`): what has been spent, cumulative, against the straight line of the
  period's pace, with the limit as a dashed `--danger` rule and, from today onwards, **where it ends at
  this rate**. One sentence says it in words: "At this rate you finish the period at $485,500 — $185,500
  over the limit." A projection is drawn as a projection: dashed, starting at today, never joined to the
  real line as if it had happened.
- **Last six periods**: one column per period, spent against **its own** limit — the limit is a dashed
  cap per column, because an adjusted month does not share the base amount — over-limit columns in
  `--danger`. The line underneath counts them: "Four of the last six went over."
- **Biggest this period**: the five largest movements of the budget, which is not the same list as the
  five most recent ones already shown below.

**Where it went** (`preview/budget-detail.html#budget-by-category`) appears **only when the budget covers
more than one category**: a `stackbar` and a list saying which of them is eating it. For a
single-category budget it would repeat the total, so it is absent. A budget holds the **whole** of each
of its categories for the period, so its figures are Stats' own figures, not a subset.

Then the period's transactions (`?categoryId=…&from&to`, or `?from&to` when global) with a link to the
filtered list, and the actions Edit and Archive (confirmed, with the footer "You can restore it later
from Past budgets.").

**What this needs from the backend.** `GET /stats/spending` takes no category filter, so the per-day
chart and the per-category breakdown exist today **only for a global budget**. For every other budget
they need `categoryIds` on that endpoint — a task on the backend's side. The pace curve and the
projection are that same series added up, and the six-period history is the budget read six times with
`?reference=`, one request per period until the backend offers a cheaper shape. The five biggest need an
order on `GET /transactions`, which does not exist either — and that same endpoint takes **one**
`categoryId`, so for a budget of several categories the filtered list is still narrowed in the client,
exactly as the transactions preview already does today. None of this is worked around by adding up money
in the client: what the backend cannot answer, the screen does not claim.

**Who computes each figure.** The API returns `spent`, `amount` and the day buckets; the client only
divides and adds up buckets the API already added — the pace per day, the cumulative curve, and the
projection (`spent ÷ elapsed days × days in the period`). Offline all of it comes from
`lib/local/derive` and carries the projection mark (component 24), like every other figure. **The
end-of-period figure is a projection twice over** — it is arithmetic, not a promise — so it is drawn
dashed, said in words, and never put where a real amount goes.

**The four states.** Data as above; **empty** — a budget whose period has no spending yet shows the
cards with an `Empty` inside each chart, "Nothing spent yet this period", never a chart of zeros; a
budget in its **first period** has no six-period history, so that card is absent rather than a single
lonely column; the projection is **absent on day 1** of a period, where dividing by one elapsed day
says nothing. **Loading** — one `Skeleton` per card at its own height. **Error** — the shared `Empty`
in `danger` with `LoadErrorBody` and Retry, per card.

**Keyboard.** Same contract as Stats: the day chart and the six-period chart are one tab stop each,
arrows move between slots, `Enter` opens what the slot leads to, and the focused slot drives the
`readout`.

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
