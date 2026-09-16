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
request and therefore its own loading, error and Retry, and which **every grouping shows since
T-82** — Categories and Tags pay a second read for it, which is the price of the tail having one shape. Its rows
date themselves by the day the movement froze, never by the device's reading of the instant. **Accounts** is the same stacked bar and the
same row list as categories, sharing `ShareRows`, with the account's colour and its type icon; the
line under it says that transfers between the user's own accounts are never counted here. Which of
the two day views is showing lives in `localStorage` (`lib/charts/day-view.ts`), beside the palette
and the language, by the owner's decision of 2026-09-12.

T-82 gives the screen its shape (owner's choice, 2026-09-16). The page is three zones: **the answer**
— the total and the breakdown of the chosen grouping, plus the three tiles under Days — and then two
labelled `section`s, **More about this month** (_Biggest this period_, and under Days the average by
weekday and the highest day's movements) and **Other months** (the way into Trends), each named by the
`h2` of its `ZoneHead`, with the card titles inside them `h3`. A zone heading is not drawn when its
zone would be empty. The way into Trends is also a labelled link in the page header, on every grouping
and every state including an empty period and a failed read, carrying the month being read when it is
not this one; `trendsHref` is built once and given to both it and the closing card. Above **1200px**
the page splits 1.6fr / 1fr like Home — not at Home's 900px, where the sidebar leaves 596px and the
wide column would land at 272px — and the empty, loading and error states stay one column at every
width. The screen no longer caps itself at 640px: it takes the shell's content cap.

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

**Before drawing a new chart, these already exist**, and a screen that rebuilds one of them drifts
from the rest. What every chart shares is not a component but a hook: **`useRovingSlots`** gives the
chart its single tab stop and moves the selection with the arrows, and `Bars`, `Heat` and
`ChartSlots` are the three that call it. The same three carry **T-80** through
**`useSlotOpen`** (`slotOpen.ts`), the single `onClick` of every slot: it opens when the pointer can
hover or when the activation is a key press (`detail === 0`), so a tap raises the bubble and the
`readout` and opens nothing while `Enter` still works — a chart anywhere in the app inherits that by
being built on one of them. `ChartSlots` is the generic one — slots, the tooltip per
slot, the hatching of the period still running and the reading line (`Readout`) — and `ColBars` and
`GBars` are built on it; `Bars` predates it and calls the hook itself, with `DayBars` wrapping it for
a calendar month and `DayHeat` doing the same over `Heat`. Around them: `ChartCard` with
`ChartSkeleton` and `ChartError` for the card's other two states, `LegendKey` for a legend swatch,
`useDayReading` for the selected day a chart and its readout share, `ShareRows` for the row list
under a chart, and `lib/storage/choice.ts` to remember a per-screen choice (a range, a mode) without
a store. Money is never added here: the only place the client adds it is `lib/local/derive`
(`sumAmounts`, `runningTotals`).

T-65 gave the line chart the same contract the bars already had: `comparisonPoints` turns the two
cumulative curves into one reading per day — both months and what separates them — and `Trend` shows
it in a bubble on hover and in the `readout` underneath, with a rule and a dot marking the position.
Day 0 is the origin of the curves, not a day, and a day the previous month never reached reads this
month alone, so neither gets a bubble that says nothing.

**T-80 does not reach this chart** — a position opens nothing, so there was never a tap to take away —
but **T-81 did**: `Trend` used to raise its reading from `onMouseEnter` alone over one span per
position, so on a phone the `readout` could only ever say the last day. It is now one surface that
turns the pointer's x into the nearest position, which the mouse drives by moving and a finger by
pressing and sliding. The positions are still not controls, so the chart stays one `role="img"` whose
name is the card's sentence; the surface is `touch-pan-y`, so a flick down the page still scrolls.
