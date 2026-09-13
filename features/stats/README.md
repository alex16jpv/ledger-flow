# Stats

Read-only aggregations over `GET /stats/spending` (W-29), routed through `readSpending`, which has
derived them from the mirror since O-F3 part 2 and answers them there with network too since O-F2b. `useStatsQuery` fetches one grouping
(`category`, `day` or `tag`) for a `[from, to)` window and a flow type; `model.ts` turns the buckets
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

T-27 spends that: **Days** gains a Bars ⇄ Calendar toggle (`DayHeat`, the same slots read as a
month), the **average by weekday** — `weekdayAverages`, the one place the client adds buckets the
server returned without adding, in minor units, before dividing — and the **biggest movements of the
period**, which is `useBiggestTransactions`: one page of five with `sort=amount&order=desc`, its own
request and therefore its own loading, error and Retry. Which of
the two day views is showing lives in `localStorage` (`lib/charts/day-view.ts`), beside the palette
and the language, by the owner's decision of 2026-09-12.
