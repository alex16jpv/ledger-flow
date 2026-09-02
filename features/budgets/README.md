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
the category icons. Detail, overrides and the form arrive with W-27 and W-28.
