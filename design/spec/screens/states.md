# Screen states

`preview/states.html`

What every list and every screen does when there is nothing to show, when it is still loading, when the
server fails and when something has to be confirmed.

- **Empty** (`#empty-list`): a neutral lg tile, a title, one sentence and a primary call to action. The
  copy per screen: Transactions "No transactions yet", Accounts "Create your first account", Categories
  "No categories of this type", Budgets "Put a ceiling on your small spending", Stats "No transactions in
  this period", To review "All detailed".
- **Loading** (`#loading-list`): skeletons in the real silhouette of the screen — search, chips, summary,
  six rows. Never a full-page spinner; a spinner only inside a button.
- **Error** (`#server-error`): a 503, `DB_UNAVAILABLE` or a network failure shows a red tile, a title, an
  explanation and "Retry", and underneath the mono line "Reference: {requestId}" for support. An error
  while saving shows a red toast with "Retry" that keeps the form.
- **Session expired** (`#session-expired`): the refresh is silent; `REFRESH_INVALID` /
  `REFRESH_REVOKED` opens a blocking sheet, "Your session ended", with "Sign in", keeping the route to
  come back to. **With a vault on the device the sheet changes identity**: it becomes the three-exit
  sheet described in [local-mode.md](local-mode.md).
- **Confirmation** (`#archive-confirmation`): always in a sheet, with a `warning` alert that names the
  object and says what is kept; the primary button carries the verb ("Archive", "Make main") and
  "Cancel" is a ghost. Final actions — deleting a transaction, archiving a budget, deleting the account
  — use `danger`.
- **New version available** (`#new-version`): when a new service worker is waiting, a toast, "New
  version available", with the action "Reload". It never reloads on its own.
- **Toast:** confirms every save, five seconds, with "Undo" where the backend can revert it (create →
  `DELETE`; make main → back to the previous one); no undo on deletions.
- **429:** a `warning` alert with a countdown; in sign-in and sign-up it disables the button.
