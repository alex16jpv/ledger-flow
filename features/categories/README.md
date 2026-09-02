# Categories

User-scoped categories for transactions and budgets. W-16 shipped the category picker: a
searchable sheet filtered by the movement type, a "Recent" strip with the three categories used
most often in the last 90 days (from `GET /stats/spending?groupBy=category`), and an inline
"New category" form so the user never leaves the transaction they were writing.

W-25 adds `CategoriesView` (`/categories?type=`): a segmented control per type with counts, a grid
of tiles with the all-time usage of each category (three unbounded `stats/spending` calls, one per
type), a dashed "New category" tile, a folded "Archived" list with Restore (409 opens
`RestoreCategoryConflictSheet`) and the "restore defaults" alert (`POST /categories/restore-defaults`,
toast with how many were recreated). `CategoryForm` is the single form: the picker uses it with a
fixed type; the pages add the live preview, the type segment (locked with a `CATEGORY_TYPE_LOCKED`
explanation when the category has history) and, on edit, "Archive category" with a confirmation.
