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
the period's transactions (client-side filtered when the budget spans several categories) and
`ArchiveBudgetSheet`. Archived budgets come back through `POST /budgets/:id/restore` (Restore on the
archived detail and on Past › Archived, Undo on the archive toast); an overlapping restore is refused
by the API and `RestoreBudgetConflictSheet` names the budget in the way and offers "Create again". W-28 adds `BudgetForm` (`/budgets/new?from=`, `/budgets/[id]/edit`): scope segment (global or by
category), expense-category chips (archived ones kept on edit), the six period types with native date
inputs for CUSTOM (inclusive end → half-open API window), amount, color and the advanced options
(effective from, note). `budgetSuggestions` (owner request F-01) scales the global-budget chips by
currency or by last month's spending.

O-F2a routes the list and the detail through `lib/local/repository`, and since O-F3 part 2 the
mirror answers both offline: it stores the saved shape (`SyncBudget`) and builds the view on top,
`spent` included, over the rows the `dateCursor` index selects for the period. `fetchSpendingTotal`
goes through the same stats seam as the other five call sites. The reads reach the server and fail
honestly instead of showing a
figure nobody computed.

Writes go through `lib/local/outbox` (O-F4). The API answers with the **view**, which drops the
override map, the CUSTOM dates and the owner, so a confirmed write merges the server's fields over
the projected row instead of replacing it and the next pull brings the authoritative one. `spent`
and its progress bars carry the amber projection mark while the queue is not empty.
