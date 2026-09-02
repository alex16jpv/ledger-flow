# Home

The month at a glance: spending hero, daily bars, budget progress, accounts and recent
transactions. W-10 ships the header; W-14 and W-22 fill the rest.

W-22 completes the screen: `dayBars` turns the server's day buckets into one bar per day of the month
(gaps at 0, today highlighted), the pending alert reads count and total from
`?pendingDetails=true&limit=1&includeSummary=true`, `topBudgets` ranks the non-global budgets by share
consumed and `budgetStatus` phrases them (left · on track, at n% with d days left, over by x). The
recent movements are composed in the app layer (`RecentTransactions`) because they reuse the
transactions row and the account and category lookups of other features.
