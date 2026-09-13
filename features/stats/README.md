# Stats

Read-only aggregations over `GET /stats/spending` (W-29), routed through `readSpending`, which has
derived them from the mirror since O-F3 part 2 and answers them there with network too since O-F2b. `useStatsQuery` fetches one grouping
(`category`, `day`, `account` or `tag`) for a `[from, to)` window and a flow type; `model.ts` turns the buckets
into shares of the API total and fills the missing days of the month with zeros. The presentational
pieces live in `components/StatsCards.tsx`; the screen is composed in the app layer because it
resolves category names and lists the transactions of the biggest day.

Since T-26 `daySeries` also reports each day's transaction count and whether the day has arrived, and
the by-day card draws the same `DayBars` Home does — the hover that showed nothing was the one
component used two different ways. The priciest day, its window and its heading are built from the
day key at local noon (`dates.fromDayKey`, `dates.dayKeyWindow`), not at noon UTC.

T-28 taught the mirror the rest: `readSpending` now carries `categoryIds`, `groupBy=month`,
`groupBy=account` and `splitBy=category` through to `lib/local/derive`, and declines anything it
does not know instead of answering without it.

T-27 and T-29 spend that: **Days** gains a Bars ⇄ Calendar toggle (`DayHeat`, the same slots read as a
month), the **average by weekday** — `weekdayAverages`, the one place the client adds buckets the
server returned without adding, in minor units, before dividing — and the **biggest movements of the
period**, which is `useBiggestTransactions`: one page of five with `sort=amount&order=desc`, its own
request and therefore its own loading, error and Retry, and which **Accounts shows too**. Its rows
date themselves by the day the movement froze, never by the device's reading of the instant. **Accounts** is the same stacked bar and the
same row list as categories, sharing `ShareRows`, with the account's colour and its type icon; the
line under it says that transfers between the user's own accounts are never counted here. Which of
the two day views is showing lives in `localStorage` (`lib/charts/day-view.ts`), beside the palette
and the language, by the owner's decision of 2026-09-12.

T-31 adds **Trends** (`/stats/trends`), the one screen here that reads a range of months instead of
one, in **five** reads and no duplicates: spending by month **with its category splits** (one read
serves both the spending series and the stack, since `splitBy` only adds the splits), income by month,
the category ranking over the range, and the two day curves. `trends.ts` holds its model: `trendWindow`
builds the six- or twelve-month window, `trendMonths` starts the series where the data starts instead
of padding the months before it with zeros, `monthComparison` walks this month and the previous one
from their own day one — reading both at the last day they share, so 31 March against February has a
comparison and not a shrug — and `categoryMix` stacks each month out of the top five categories, ranked
by the API's own `groupBy=category` totals and never by adding splits up, leaving the rest of the
month's total in `Other`. `savings` is the rule-4 care: it takes the running month **off** the two
range totals the API returned rather than adding the month buckets, so _Saved_ and _Savings rate_ count
complete months only without the client ever summing money; when no month has finished they say so
instead of painting a zero. The one addition it does make, the running total of the two comparison
curves, goes through `runningTotals` in `lib/local/derive`, which is the only place allowed to add
money in the client.

The screen is composed in the app layer for the same reason the others are: it reads three features'
hooks. Its charts are `GBars` and `ColBars`, both built on `ChartSlots`, which owns the one tab stop,
the tooltip per slot and the readout line that every chart in `design/spec/components.md` promises.
