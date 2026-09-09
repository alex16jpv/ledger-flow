# Budgets

`preview/budgets.html`

- A header with two actions: past and archived budgets (`archive`), and new.
- Period navigation (`?reference=`), with "next" disabled on the current period; the filter by period
  type is applied on the client.
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
- **Empty:** an illustration with a `chart-pie` tile, "Put a ceiling on your small spending", and a call
  to action to create the global one.
