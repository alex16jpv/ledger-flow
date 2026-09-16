# Trends

`preview/trends.html`

`/stats/trends`, reached from any Stats view with a back arrow. **Stats answers where this month's
money went; Trends answers whether this month is better than the last ones.** They are two screens
because one period navigator cannot walk a month at a time and span six at once — on one screen the
header would contradict half the page.

Its own range instead of a period navigator: **Last 6 months / Last 12 months**, ending on the month
Stats was showing.

## The cards (`#trends`)

- **Income and spending**: `gbars`, income against spending, one pair per month, with a legend and the
  `readout` — which reads the month still running when nothing is pointed at, per component 29. **A
  month still running is drawn hatched and its readout says "in progress"**, and it is left out of
  every figure that claims to be a month's: the two tiles underneath, _Saved_ and _Savings rate_, count
  complete months only and say how many. A savings rate worked out from three weeks of spending against
  a whole salary is a lie the chart would tell for free. When **no month in the range has finished**
  (`#trends-first-month`) the two tiles say so — "Not yet" — instead of painting a zero, which would be
  the same lie in the other direction.
- **This month against last**: `trend` with two lines over the same days of the month — this one
  solid, the same days of the previous month dashed — and one sentence: "You have spent $1,284,300 so
  far — 2 % less than at this point in August." **Pointing at a day reads both lines at that day and
  what separates them**: "Day 12 · September $1,240,000 · August $950,000 · +30%", in the bubble and
  in the `readout` under the chart — with a pointer by hovering, with a finger by touching the chart
  and sliding along it (T-81). The sentence answers the month, the slot answers the day, and a
  card whose whole point is a comparison never reads one line alone. Where the previous month never
  reached that day the slot reads this month only, and where it spent nothing there is no percentage
  to give rather than a division by zero dressed up as one. Comparing a finished month against one in its third
  week is the mistake this card exists to prevent. Two cases change the wording rather than the
  arithmetic. **A previous month shorter than the days already elapsed** — 31 March against February —
  has no "this point" to answer: the two are read at the last day they share and the sentence says
  which, rather than claiming there is nothing to compare. And **a month that already ended**
  (`#trends-finished-month`), which is what arriving from a past month in Stats gives: nothing in it is
  "so far", so the card is named "August against July" and the sentence says what was spent.
- **Where it goes**: stacked columns (component 33), one column per month with the top five categories and
  "Other", so a category that is quietly growing shows up as a band that widens. Its `readout` names the
  biggest category of the whole range. The running month is hatched here too.
- A closing line: a month is counted in the user's time zone, like every other figure in the app.

## Who computes each figure

House rule 4: the client computes no money except the offline projection in `lib/local/derive`, and
whatever is projected says so. Every figure on this screen, and where it comes from:

| Figure                                 | Where it comes from                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending per month, and its categories | One `GET /stats/spending` with `groupBy=month&splitBy=category`. `splitBy` only **adds** the splits, so the same read is the spending series and the stack: two would be the same question asked twice (rule 24). Served since T-24.                                      |
| Income per month                       | `GET /stats/spending` with `groupBy=month`, its own flow type. Served since T-24.                                                                                                                                                                                         |
| _Saved_, _Savings rate_                | Subtraction and a ratio over totals the API returned, over complete months only. Never over buckets.                                                                                                                                                                      |
| The five categories stacked            | `groupBy=category` over the same range: the ranking is the API's own totals, never the splits added up. "Other" is the month's own total less the five, so a column adds up to exactly the figure its name says — which holds because an expense split is never negative. |
| This month's curve, last month's curve | Two calls with `groupBy=day`; the running total is a cumulative sum of buckets the API returned.                                                                                                                                                                          |
| "n % less than at this point"          | A ratio of the two curves at the last day both months have.                                                                                                                                                                                                               |

Five reads, each a different question. Offline, all of them come from the mirror through
`lib/local/derive`, which is the only place allowed to add money in the client — and every figure it
produces carries the projection mark (component 24) exactly as Home's hero does: the three charts and
the two tiles alike. A range the mirror does not hold (the twelve-month range on a device that only
pulled three) shows the months it has and starts the axis there; it never draws a zero for a month it
cannot see. **It cannot yet tell a month the device never pulled from a month with nothing in it**, so
the notice says the second — which is true of the common case and understates the rare one.

## The four states

- **Data** (`#trends`): as above.
- **Empty** (`#trends-empty`): an account with nothing in the range — one `Empty`, "Not enough history
  yet", with a line that says what to do next. A chart with no data is never drawn as flat zeros. It is
  one `Empty` for the whole screen and not one per card, because every card here answers the same
  question over the same range: if there is nothing to compare, there is nothing to compare three
  times. The range control stays above it, since another range is the way out.
- **The first month** (`#trends-first-month`): one month, still running. Nothing has finished, so the
  two tiles say "Not yet"; and with nothing spent yet the middle card carries its own `Empty`,
  "Nothing spent in September", which is the only per-card empty on this screen.
- **Partial** (`#trends-short-history`, the common one): fewer months than the range asks for. The
  chart shows the months that exist, the axis starts where the data starts, and the tiles say over how
  many months they counted. The range control stays **above** the notice and stays usable: a range the
  history cannot fill is still a range the reader may want to leave.
- **Loading** (`#trends-loading`): one `Skeleton` per card, at the card's own height, so the page does
  not jump. The range control is already usable.
- **Error** (`#trends-error`): the shared `Empty` in `danger` with `LoadErrorBody` and Retry, per card
  — one card failing does not blank the screen. **Which cards fall together** is what the five reads
  decide, and it is not one read per card: _Income and spending_ and its tiles need the income read and
  the spending read; _This month against last_ needs its own two day reads and nothing else; _Where it
  goes_ needs the spending read and the category ranking. So the spending read takes the first and the
  third down together, while the income read, the ranking and the two day reads each take one card. The
  plate draws the ranking failing, which is the case that isolates one card cleanly.

## Recurring — decided: both, detection first

`preview/variants.html#recurring-found-by-the-app` · `#recurring-set-up-by-you` · `#recurring-both`

A recurring expense can be two different features, and the owner asked for the question to be thought
through rather than answered by default (2026-09-11). Asked, he chose **both, in this order**: the
three routes are kept below because the order is the decision. Nothing here is drawn yet — the
plates and the spec of each half come in its own design pass, and declaring needs one of its own.

- **Found by the app.** Nothing new to fill in: the history is read, what repeats is grouped, and what
  always arrives and has not is flagged. It changes no data and works on what is already there — and
  it can be wrong, so it is drawn as an observation, never as a figure and never inside a total.
- **Set up by you.** A recurring transaction becomes a thing the user creates, with a schedule, and
  the app writes it on its day. It is exact, and it is a feature of its own: a new entity in the
  backend, occurrences that can be skipped or edited, and money written without anybody pressing save
  — which house rules 1 and 3 touch directly, and which needs its own design phase.
- **Both, in this order.** What the user set up is the truth; what the app found and the user never
  set up is an offer, never a figure. Detection first, because it changes no data and answers the case
  the owner named — the expense that repeats every month and was never declared.

Detection would need a grouping by description over a range, which the backend does not have.
