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
`ArchiveBudgetSheet` (final, no restore). The form arrives with W-28.
