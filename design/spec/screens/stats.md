# Stats

`preview/stats.html`

One period at a time. _Is this month better than the last ones_ is a different question with a
different range, and it has a screen of its own: [trends.md](trends.md).

Period navigation (a month; the range is sent as `[start, end)` in the user's zone); flow chips
(Expenses by default, Income, Transfers, and Adjustments only when asked for); a segmented control
for **Categories / Days / Accounts / Tags** (`groupBy`); and a total card (`total`, the number of
transactions, the average).

- **By category** (`#by-category`): a proportional stacked bar (`stackbar`, each category in its
  colour; **every segment names its category in a bubble** on hover). The bar is not a set of
  controls — the list underneath is the way in, so making six segments six tab stops would only add
  noise — which means the bubble is pointer-only and **the bar's own accessible name reads every
  segment with its share**: that is what a keyboard and a reader get, and it is the whole reading and
  not a headline. Then a `row` list with a mini progress bar, the percentage, the amount and the
  count; `uncategorized` appears as
  "Uncategorized" with a `hash` tile; archived categories are resolved with `includeArchived` and
  badged. Tapping a row opens Transactions filtered by that category and range.
- **By day** (`#by-day`): `Bars` 140px tall, **every bar a control that says its day and its amount**
  on hover, on focus and in the `readout` line underneath, and opens that day where the pointer can
  hover (T-80); gaps at zero, the
  highest day and today at full strength, and **the days that have not arrived drawn as a rule, not as
  a zero**; minimal axes (1, 15, the end). Under it: the priciest day, the daily average and the days
  with no spending; **the average by weekday** (`Bars` again, seven slots, the most expensive one
  named in the line underneath); the list of the highest day; and **the biggest movements of the
  period**, which is a different question from the biggest day and the one people actually ask.
- **By day, as a calendar** (`#spending-calendar`): the same data and the same card, one toggle apart
  — `heat`, a cell per day in four steps, a Less/More scale, weeks starting on the language's first
  day. A row of bars hides which weeks and which weekdays were expensive; the calendar shows it. The
  toggle is remembered **in `localStorage`, beside the palette and the language** (owner, 2026-09-12):
  it is a per-browser choice, like the other two, and it costs the backend nothing. The consequence is
  written down rather than hidden: the phone and the laptop can sit on different views.
- **By account** (`#by-account`): which card or account the money left from — the same `stackbar` and
  the same `row` list as categories, with the account's colour and the icon of its type. Archived
  accounts are resolved with `includeArchived` and badged, exactly as categories are; the server's own
  bucket for a row with no account on either side appears as "No account" and an account the device
  cannot resolve as "Unknown account". **"No account" is the one row that does not open anything**:
  `/transactions` has no filter that could narrow it, so it is a figure and not a control. Transfers
  between the user's own accounts are **not** spending and never appear here; a line under the list
  says so **when the flow chip is Expenses**, which is the only reading it is true of — under the
  Transfers chip this view is, by definition, listing transfers.
- **By tag** (`#by-tag`): an alert about double counting and the untagged amount (`untagged`); a list
  per tag with its count; tapping opens Transactions `?tag=`.

Every view with data ends with the way into Trends, **and so does an empty period** — a month with
nothing in it is exactly the reader asking whether another one was better; a failed read offers Retry
and nothing else. Export is visible and inactive ("soon"). Empty: "Nothing
recorded in this period", "Try another month or another type of movement" — and under Accounts, with
Expenses chosen, one more line, because a month whose only movements were transfers between the
user's own accounts lands here and has to say why.

## Trends lives next door

`/stats/trends` is its own screen with its own spec, [trends.md](trends.md): a range of months cannot
share a period navigator with a single month. Every Stats view ends with the way into it, carrying the
month being read when it is not this one, and **Recurring expenses** — decided on 2026-09-11, detection
first — is written up there.

## What this needs from the backend

Four of the views above need more than `groupBy`, `type`, `from` and `to`, and each of them was a task
on the backend's side rather than a copy of the arithmetic in the client. Three are already served:

| View                                       | What it needs                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| By account                                 | `groupBy=account` — **served since T-24**, and derived by the mirror since T-28.                                                                                                                                    |
| Trends: income and spending, where it goes | `groupBy=month` and the month × category cross (`splitBy=category`) — **served since T-24**, so twelve months are one request instead of twelve.                                                                    |
| Biggest movements                          | `sort=amount&order=desc` on `GET /transactions` — **served since T-25**, so the five biggest are one page of five and not every page of the period read to sort in the client, which is what house rule 24 forbids. |
| Recurring, if it is ever detected          | Grouping by description over a range; nothing exists today.                                                                                                                                                         |

`GET /stats/spending` does **not** paginate or cap its buckets, so `groupBy=day` with no `from`/`to`
would answer a bucket per day of the whole history in one body. The window is always the screen's to
send, and this screen always sends the month it is showing.

The average by weekday needs nothing new: it is the day buckets read a second way.

**Who computes what.** House rule 4 stands. The API returns the buckets and the totals; over them the
client divides, ratios and picks a maximum — the daily average, the percentages, the priciest day, the
no-spend count — and in one place it **adds** buckets the server returned but did not add together: the
average by weekday sums the three or four buckets of each weekday before dividing. That addition is
integers in minor units over figures the server produced, never over anything the client invented.
Offline all of it comes from `lib/local/derive` over the mirror and carries the projection mark
(component 24). No figure here is money the server never saw.

**The four states**, per card: data; **empty** — one `Empty`, "No transactions in this period", never a
chart of zeros; **loading** — a `Skeleton` at each card's own height; **error** — the shared `Empty` in
`danger` with `LoadErrorBody` and Retry, per card, so one failure does not blank the screen. The day
chart and the calendar have a case of their own: a month before the account existed is **empty**, not a
month of no-spend days. Drawn in `#days-loading`, `#days-empty`, `#days-card-error`,
`#accounts-loading`, `#accounts-empty` and `#accounts-error`: the period navigator, the flow chips and
the segmented control never go away, because they are what the user needs to get out of an empty or a
broken period. The **biggest movements** are their own request — an ordered page of five, not the
buckets — so they are the one card that can fail on its own while the rest of the view has figures.

**Keyboard**, for every chart here: the chart is one tab stop, not thirty. Focus enters on the selected
slot, the arrow keys move between slots (up and down move a week at a time inside the calendar), `Home`
and `End` jump to the ends, and `Enter` opens what the slot leads to — the roving `tabindex` pattern.
The slot under focus shows its bubble and drives the `readout`, so a keyboard user and a pointer user
read the same line. A chart whose slots lead nowhere — the weekday average — is not a set of controls
at all: it is one `role="img"` carrying the whole reading in its accessible name, which is what `Bars`
already does today when it is given no action.
