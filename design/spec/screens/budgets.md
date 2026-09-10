# Budgets

`preview/budgets.html`

- A header with two actions: past and archived budgets (`archive`), and new.
- Period navigation (`?reference=`), with "next" disabled on the current period; the filter by period
  type is applied on the client. **Creating from this screen follows that filter**: under "Weekly" the
  screen offers a weekly budget, under "All" a monthly one.
- **The global budget as a featured card** (a `--brand-soft` gradient): spent over limit, progress with
  the pace mark — focusable and with its tooltip, but **without** the legend line, which does not fit
  here without noise — what is left, and "≈ per day" for the rest of the period; badge "Global". When
  there is none: a dashed card inviting the user to create a total monthly budget.
- **One card per budget:** a tile in its colour, the name, "{period type} · {range}", badges
  (`hasOverride` → "Adjusted", `archivedCategoryIds` → "Archived category", CUSTOM → "ends in n days" or
  "Ended" at 0.72 opacity), spent at 24px over the limit, progress (`warn` at 80%, `over` past 100%) and
  a sentence of status: "X left · n days", "Over by X", "nothing spent yet".
- An informative footer: adjustments and transfers never count.
- Pagination through `hasMore`/`nextCursor`; short pages are possible.
- **No budget for the selected filter** while the month has others: the sentence "No {period} budgets
  this month" and, on the current period, the same call to action for that period. Under "All" and
  "Monthly" the dashed card above already is that invitation, so the sentence stays alone.
- **Empty:** an illustration with a `chart-pie` tile, "Put a ceiling on your small spending", the line
  of the selected period ("A total weekly budget shows how much is left before the week ends.") and a
  call to action that names it ("Create a weekly budget").
- **The one-amount sheet** behind that call to action is titled after the period ("A ceiling for the
  week"), asks for a "Weekly amount" and creates the global budget of that period; the suggested
  amounts are last month's spending scaled to the period's length. Its note drops "any month" for
  "in any period", which is true whatever the period is.
- **"Custom" has no sheet:** its window is two dates the user picks, so there the call to action is a
  link to New budget with the period already selected.
