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
  transactions, filtered to the budget's category where the backend can filter by one (see below), where
  the pointer can hover (T-80).
- **Against the pace** (`trend`): what has been spent, cumulative, against the straight line of the
  period's pace, with the limit as a dashed `--danger` rule and, from today onwards, **where it ends at
  this rate**. One sentence says it in words: "At this rate you finish the period at $485,500 — $185,500
  over the limit." A projection is drawn as a projection: dashed, starting at today, never joined to the
  real line as if it had happened. **Pointing at a day reads every line at it** — "Day 12 · Spent
  $412,000 · Expected $480,000" — in the bubble and in the `readout`, and a day the projection covers
  says so instead of passing a guess off as spending.
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

**What this asks the backend for.** `GET /stats/spending` takes `categoryIds` (T-24) and
`GET /transactions` takes `sort=amount` with `order` and `categoryIds` (T-25), so the per-day chart, the
per-category breakdown and the five biggest exist for **any** budget, not only a global one, and the
five biggest are one page of five rather than every page sorted in the client. The pace curve and the
projection are that same day series added up. The **six-period history is the budget read six times**
with `?reference=`: with `READ_SOURCE = "mirror"` those are six reads of the local copy and no requests
at all, and only a copy that cannot answer falls back to six of them — accepted as it is (owner's
decision, 2026-09-13) rather than held back for a cheaper shape on the backend. What is still one
`categoryId` is the **Transactions screen's own filter**, so "See all" from a budget of several
categories opens the period without narrowing to them. None of this is worked around by adding up money
in the client: what the backend cannot answer, the screen does not claim.

**Who computes each figure.** The API returns `spent`, `amount` and the day buckets; the client only
divides and adds up buckets the API already added — the pace per day, the cumulative curve, and the
projection (`spent ÷ elapsed days × days in the period`). Offline all of it comes from
`lib/local/derive` and carries the projection mark (component 24), like every other figure. **The
end-of-period figure is a projection twice over** — it is arithmetic, not a promise — so it is drawn
dashed, said in words, and never put where a real amount goes.

**The four states.** Data as above (`#detail-with-charts`); **empty** (`#detail-charts-empty`) — a
budget whose period has no spending yet shows the cards with an `Empty` inside each chart, "Nothing
spent yet this period", never a chart of zeros, while the six previous periods did happen and keep
their figures. A budget in its **first period** has no six-period history, so that card is absent
rather than a single lonely column, and the projection is **absent on day 1** of a period, where
dividing by one elapsed day says nothing — the two together are `#detail-first-period`, and the pace
card says why in words instead of drawing a dashed end. **Loading** (`#detail-charts-loading`) — one
`Skeleton` per card at its own height. **Error** (`#detail-charts-error`) — the previous periods and
the biggest movements are each their own reading, so their failure takes their own card, with the
shared `Empty` in `danger`, `LoadErrorBody` and Retry, and leaves the rest standing; the day chart and
the pace curve are **one** reading — the curve is that day series added up — so they fall together.

**A period that is over still says what it did.** The four cards are a reading, not an action, so they
are drawn for a past period, for an ended budget and for an archived one (`#archived`), which is the
period a user most wants to look back at. The projection disappears on its own there: with no days left
there is nothing to project.

**Keyboard.** Same contract as Stats: the day chart is one tab stop, arrows move between slots,
`Enter` opens the day, and the focused slot drives the `readout`. The six-period chart is the same
where a column leads somewhere — a MONTHLY budget, whose period `reference` in the URL can name; for
every other period type the URL cannot name the column, so the chart is one `role="img"` that reads
all six columns, exactly as the weekday average of Stats does (component 18).

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
