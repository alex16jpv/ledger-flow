# Stats

Read-only aggregations over `GET /stats/spending` (W-29), routed through `readSpending`, which has
derived them from the mirror since O-F3 part 2 and answers them there with network too since O-F2b. `useStatsQuery` fetches one grouping
(`category`, `day` or `tag`) for a `[from, to)` window and a flow type; `model.ts` turns the buckets
into shares of the API total and fills the missing days of the month with zeros. The presentational
pieces live in `components/StatsCards.tsx`; the screen is composed in the app layer because it
resolves category names and lists the transactions of the biggest day.
