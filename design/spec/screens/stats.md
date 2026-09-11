# Stats

`preview/stats.html`

One period at a time. _Is this month better than the last ones_ is a different question with a
different range, and it has a screen of its own: [trends.md](trends.md).

Period navigation (a month; the range is sent as `[start, end)` in the user's zone); flow chips
(Expenses by default, Income, Transfers, and Adjustments only when asked for); a segmented control
for **Categories / Days / Accounts / Tags** (`groupBy`); and a total card (`total`, the number of
transactions, the average).

- **By category** (`#by-category`): a proportional stacked bar (`stackbar`, each category in its
  colour; **every segment names its category in a tooltip** on hover or focus) plus a `row` list with a
  mini progress bar, the percentage, the amount and the count; `uncategorized` appears as
  "Uncategorized" with a `hash` tile; archived categories are resolved with `includeArchived` and
  badged. Tapping a row opens Transactions filtered by that category and range.
- **By day** (`#by-day`): `Bars` 140px tall, **every bar a control that says its day and its amount**
  on hover, on focus and in the `readout` line underneath, and opens that day; gaps at zero, the
  highest day and today at full strength, and **the days that have not arrived drawn as a rule, not as
  a zero**; minimal axes (1, 15, the end). Under it: the priciest day, the daily average and the days
  with no spending; **the average by weekday** (`Bars` again, seven slots, the most expensive one
  named in the line underneath); the list of the highest day; and **the biggest movements of the
  period**, which is a different question from the biggest day and the one people actually ask.
- **By day, as a calendar** (`#spending-calendar`): the same data and the same card, one toggle apart
  — `heat`, a cell per day in four steps, a Less/More scale, weeks starting on the language's first
  day. A row of bars hides which weeks and which weekdays were expensive; the calendar shows it. The
  toggle is remembered. Where: the only preference store the app has today is
  `localStorage`, which is per browser and not per user — whether this one deserves a row in the
  profile is a decision, not an assumption.
- **By account** (`#by-account`): which card or account the money left from — the same `stackbar` and
  the same `row` list as categories, with the account's colour and icon. Transfers between the user's
  own accounts are **not** spending and never appear here; a line under the list says so.
- **By tag** (`#by-tag`): an alert about double counting and the untagged amount (`untagged`); a list
  per tag with its count; tapping opens Transactions `?tag=`.

Every view ends with the way into Trends. Export is visible and inactive ("soon"). Empty: "No
transactions in this period".

## Trends lives next door

`/stats/trends` is its own screen with its own spec, [trends.md](trends.md): a range of months cannot
share a period navigator with a single month. Every Stats view ends with the way into it, and the
question about **Recurring expenses** — proposed, not decided — is written up there.

## What this needs from the backend

`GET /stats/spending` takes `groupBy`, `type`, `from` and `to`, and nothing else. Four of the views
above need more, and each is a task on the backend's side, not a copy of the arithmetic in the client:

| View                                       | What is missing                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| By account                                 | `groupBy=account`.                                                                                                                                                                                                                               |
| Trends: income and spending, where it goes | `groupBy=month` (and `groupBy=category` within a month range), so twelve months are one request instead of one per month.                                                                                                                        |
| Biggest movements                          | An order on `GET /transactions`. Today the list only comes back newest first and takes no sort, so "the five biggest" cannot be asked for — and reading every page of a period to sort them in the client is exactly what house rule 24 forbids. |
| Recurring, if it is ever detected          | Grouping by description over a range; nothing exists today.                                                                                                                                                                                      |

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
month of no-spend days.

**Keyboard**, for every chart here: the chart is one tab stop, not thirty. Focus enters on the selected
slot, the arrow keys move between slots (up and down move a week at a time inside the calendar), `Home`
and `End` jump to the ends, and `Enter` opens what the slot leads to — the roving `tabindex` pattern.
The slot under focus shows its bubble and drives the `readout`, so a keyboard user and a pointer user
read the same line. A chart whose slots lead nowhere — the weekday average — is not a set of controls
at all: it is one `role="img"` carrying the whole reading in its accessible name, which is what `Bars`
already does today when it is given no action.
