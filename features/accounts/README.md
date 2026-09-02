# Accounts

Money holders: list, detail, create/edit, main account, archive/restore (W-23) and balance
adjustments (W-24).

`AccountPicker` (W-16) is the shared account selector: a `Picker` that opens a sheet listing the
active accounts with their type tile, "Main" badge and live balance. `exclude` hides one account so
the two sides of a transfer can never be the same; archived accounts are not offered.

`AccountsView` (W-23) loads the whole list once with `includeArchived=true` (a user is capped at
100 accounts, one page) and derives the summary card, the active grid and the folded "Archived"
section through `summarizeAccounts`. `AccountForm` creates and edits: the balance field exists only
on creation (it becomes the immutable `openingBalance`), a live `AccountCard` previews the result and
a `409 DUPLICATE` is shown under the name with the case-insensitive explanation. The detail screen
lives in the app layer because it composes the transactions of the account; the confirmation sheets
(`MakeMainSheet`, `ArchiveAccountSheet`, `RestoreConflictSheet`) and `AccountHero` live here.
