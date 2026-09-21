# Budgets

Spending ceilings per period. The onboarding (W-13) and the home CTA create the global monthly
budget through `GlobalBudgetForm`; W-26 adds the list.

`BudgetsView` (`/budgets?reference=YYYY-MM&period=`) resolves the month in the user's time zone,
sends the local start of the month as `reference`, follows `hasMore` (the server filters expired and
pre-floor budgets after paginating) and splits the result into the featured global monthly card
(`GlobalBudgetCard`, with the pace marker and the "left for n days / ≈ per day" line) and one
`BudgetCard` per budget with the status phrase from `budgetProgress`. The period-type filter is
client-side and lives in the URL. `PastBudgetsView` (`/budgets/past`) lists ended CUSTOM budgets and
archived ones with "Create again". The screens are composed in the app layer because the tiles need
the category icons. W-27 adds the detail (`/budgets/[id]?reference=`): `BudgetHero` (remaining, pace per elapsed day,
days left), `PeriodAmountCard` with the override actions (`OverrideSheet` → `PUT …/amount?reference=`,
skip = amount 0, remove = `DELETE …/amount`), the categories chips with the archived mark, the note,
the period's transactions and
`ArchiveBudgetSheet`. Archived budgets come back through `POST /budgets/:id/restore` (Restore on the
archived detail and on Past › Archived, Undo on the archive toast); an overlapping restore is refused
by the API and `RestoreBudgetConflictSheet` names the budget in the way and offers "Create again". W-28 adds `BudgetForm` (`/budgets/new?from=`, `/budgets/[id]/edit`): scope segment (global or by
category), expense-category chips (archived ones kept on edit), the six period types with native date
inputs for CUSTOM (inclusive end → half-open API window), amount, color and the advanced options
(effective from, note). `budgetSuggestions` (owner request F-01) scales the global-budget chips by
currency or by last month's spending, and then by the period asked for: those figures are monthly, so
a weekly budget is offered a week's share of them.

Creating from the list follows the period filter: the empty state and the "No {period} budgets this
month" line offer a budget of the selected type — "All" means monthly, as it did — and the sheet
behind them creates the global budget of that period (`GlobalBudgetForm` takes a
`RecurringBudgetPeriod`, monthly by default, which is what the onboarding and the home CTA still
use). CUSTOM is the exception: its window is two dates a person picks, so there the call to action is
a link to `/budgets/new?period=CUSTOM`. Under "All" and "Monthly" the dashed global card already is
that invitation, so the line does not repeat it.

O-F2a routed the list and the detail through `lib/local/repository`, and since O-F3 part 2 the mirror
answers both — with network too, since O-F2b: it stores the saved shape (`SyncBudget`) and builds the
view on top, `spent` included, over the rows the `dateCursor` index selects for the period.
`fetchSpendingTotal` and `fetchBudgetSpending` go through the same stats seam as the other call
sites. With no profile in
the mirror there is no zone to cut the period on, so the read reaches the server and fails honestly
instead of showing a figure nobody computed.

Writes go through `lib/local/outbox` (O-F4). The API answers with the **view**, which drops the
override map, the CUSTOM dates and the owner, so a confirmed write merges the server's fields over
the projected row instead of replacing it and the next pull brings the authoritative one. `spent`
and its progress bars carry the amber projection mark while the queue is not empty.

The pace mark on a progress bar is a focusable control (F-08): it carries its own `aria-label` and a
tooltip, "Day 22 of 30 · 73% expected", wherever it is drawn — the Home hero, the global card and the
detail. Only the detail repeats it as a fixed line under the bar, because a tooltip does not exist
for a finger and it is the one screen with room. `budgetProgress` returns the `day` and `days` that
text says out loud. The CUSTOM dates and "Effective from" use the app's own calendar (F-05), so the
end can never be set before the start: that day is not offered.

T-30 adds **what the period is doing** to the detail (`BudgetCharts`, in the app layer because the
cards compose budgets, stats and transactions). Four cards: the day chart over the budget's own
period (`categoryIds` on `/stats/spending`, T-24); the cumulative curve against the period's pace
with the end-of-period projection (`paceSeries` in `charts.ts` — the API's own day buckets added in
minor units, divided once, and drawn dashed from today, never joined to the real line); the last six
periods, each against **its own** limit, because an adjusted period does not share the base amount;
and the five biggest movements (`sort=amount`, T-25). A fifth card, "Where it went", appears only
when the budget covers more than one category, where a breakdown says something the total does not.

`fetchBudgetHistory` reads the budget once per period, walking back from one millisecond before each
`periodFrom`, which lands inside the period before it whatever its length — so the client never
re-derives the period algebra and a server that answers with the same or a later window stops the
walk. With `READ_SOURCE = "mirror"` those are six local reads and no requests; the owner accepted
that cost on 2026-09-13 rather than wait for a backend shape that serves them together. A CUSTOM
budget is one window that never repeats, so the card and its reads are skipped; a budget in its first
period has one column and the card is absent. A column opens its period only for a MONTHLY budget,
which is what `reference` in the URL can name; elsewhere the chart reads itself as one image, like
the weekday average of Stats. And only where the pointer can hover, or from the keyboard: T-80 made a
bare tap the reading and nothing more, for every chart in the app.

T-65 gave the pace curve a reading a day at a time too — spent against expected in a bubble and in the
`readout` — and past today it says the figure is where the projection puts it, not what was spent.
T-81 made that reading reachable with a finger: pressing the chart and sliding along it moves the day,
where before only a hovering pointer could.

Since T-74 the colour a new budget opens with is drawn at random from the sixteen tokens instead of
being `TEAL`. `defaultBudgetValues` takes it as an argument, so the draw happens once in
`NewBudgetScreen` and the defaults stay a pure function. `GlobalBudgetForm`, which shows no swatches
at all, draws one the same way instead of always writing `INDIGO`.

Since T-78 `GlobalBudgetForm` reports a typed amount to the sheet around it (`useUnsavedGuard`), and
the period override sheet passes `unsaved` directly, so neither is thrown away by a tap outside
without asking.

Since T-120 a budget's `spent` measures each movement's **`countsAsYours`** — what left the account
minus what has come back for it — rather than its amount, with and without network alike. So a
shared expense counts in full until somebody pays, and a payment lowers it **in the month the expense
happened**, which can move a period that was already closed; the movement's own history is what
explains it.
