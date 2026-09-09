# Stats

`preview/stats.html`

Period navigation (a month; the range is sent as `[start, end)` in the user's zone); flow chips
(Expenses by default, Income, Transfers, and Adjustments only when asked for); a segmented control for
Categories / Days / Tags (`groupBy`); and a total card (`total`, the number of transactions, the
average).

- **By category** (`#by-category`): a proportional stacked bar (`stackbar`, each category in its
  colour; **every segment names its category in a tooltip** on hover or focus) plus a `row` list with a
  mini progress bar, the percentage, the amount and the count; `uncategorized` appears as
  "Uncategorized" with a `hash` tile; archived categories are resolved with `includeArchived` and
  badged. Tapping a row opens Transactions filtered by that category and range.
- **By day** (`#by-day`): `bars` 140px tall with gaps at zero, peaks highlighted and today marked;
  minimal axes (1, 15, the end); stats for the priciest day, the daily average and the days with no
  spending; and the list of the highest day. Tapping a bar opens that day's transactions.
- **By tag** (`#by-tag`): an alert about double counting and the untagged amount (`untagged`); a list
  per tag with its count; tapping opens Transactions `?tag=`.

Export is visible and inactive ("soon"). Empty: "No transactions in this period".
