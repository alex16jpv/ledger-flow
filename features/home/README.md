# Home

The month at a glance: spending hero, daily bars, budget progress, accounts and recent
transactions. W-10 ships the header; W-14 and W-22 fill the rest.

W-22 completes the screen: `dayBars` turns the server's day buckets into one bar per day of the month
(gaps at 0, today highlighted), the pending alert reads count and total from
`?pendingDetails=true&limit=1&includeSummary=true`, `topBudgets` ranks the non-global budgets by share
consumed and `budgetStatus` phrases them (left · on track, at n% with d days left, over by x). The
recent movements are composed in the app layer (`RecentTransactions`) because they reuse the
transactions row and the account and category lookups of other features.

O-F2a routes the accounts, categories and pending-tray reads through `lib/local/repository`, so the
mirror can answer them offline; since O-F3 part 2 the month's spending and the budgets answer there
too, so all five reads are local and `QUERY_DOMAINS.home` is in `MIRROR_BACKED_DOMAINS`. The figures
it paints offline are projections and none of them is marked yet — the amber tone arrives with the
outbox in O-F4/O-F5a.
