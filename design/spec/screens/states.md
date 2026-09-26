# Screen states

`preview/states.html`

What every list and every screen does when there is nothing to show, when it is still loading, when the
server fails and when something has to be confirmed.

- **Empty** (`#empty-list`): a neutral lg tile, a title, one sentence and a primary call to action. The
  copy per screen: Transactions "No transactions yet", Accounts "Create your first account", Categories
  "No categories of this type", Budgets "Put a ceiling on your small spending", Stats "No transactions in
  this period", To review "All detailed".
- **Loading** (`#loading-list`): skeletons in the real silhouette of the screen — search, chips, summary,
  six rows. Never a full-page spinner; a spinner only inside a button. The container that holds them is
  `role="status"` with `aria-busy` and the name "Loading" — see `../accessibility.md` for why the role is
  not optional.
- **Error** (`#server-error`): a 503, `DB_UNAVAILABLE` or a network failure shows a red tile, a title, an
  explanation and "Retry", and underneath the mono line "Reference: {requestId}" for support. An error
  while saving shows a red toast with "Retry" that keeps the form. **When the error replaces the whole
  screen** — a route's error boundary, where the screen's own header is gone with it — **its title
  carries the page's `h1`**; the composition and the size do not change, only the level, because
  otherwise the document has no first heading at all.
- **Session expired** (`#session-expired`): the refresh is silent; `REFRESH_INVALID` /
  `REFRESH_REVOKED` opens a blocking sheet, "Your session ended", with "Sign in", keeping the route to
  come back to. **With a vault on the device the sheet changes identity**: it becomes the three-exit
  sheet described in [local-mode.md](local-mode.md).
- **Confirmation** (`#archive-confirmation`): always in a sheet, with a `warning` alert that names the
  object and says what is kept; the primary button carries the verb ("Archive", "Make main") and
  "Cancel" is a ghost. Final actions — deleting a transaction, archiving a budget, deleting the account
  — use `danger`.
- **Leaving with something typed** (`#unsaved-before-leaving`): a tap outside a sheet closes it, and
  ESC does the same, so a half-written form would go with it. When there is something to lose, neither
  closes: the sheet asks, in a **centred dialog over it** — a `warning` alert, "Keep editing" as the
  primary and focused action, "Leave" as a quiet `dangerGhost` — and everything behind the question goes
  inert, so nothing behind it can be pressed. ESC answers "Keep editing", and so does a tap outside the
  question. Since T-104 the **close button and the footer's Cancel ask the same question**, because
  those are the two a thumb hits by accident; a sheet with nothing typed closes on the first tap,
  whichever exit it is. Since T-150 the question is that dialog on every width, where it used to take
  the footer's place: a full-screen sheet has no footer to swap, and at the end of the body it could land
  under the keyboard. Which sheets count as having something to lose is listed in
  `../../../DECISIONS.md` under T-78.
- **An address that cannot name a row** answers **404 with no request at all**, and shows the public
  404 ([public.md](public.md) `#not-found`) — there is no separate in-app 404. A detail route's `[id]`
  matches any segment, so `/accounts/nope` used to answer 200 and then ask the server for a row that
  cannot exist. The status has to be decided **above** the app group's streaming boundary, and Next
  skips the layout that throws, which is the one that draws the frame: so a 404 with the tab bar is
  not reachable without moving that boundary, and the public 404 is what answers. **A well-formed id
  the app does not know is not this state:** it renders its screen and its own error, which is what
  lets the copy on the device answer with no network.
- **New version available** (`#new-version`, T-196, owner's choice of 2026-09-25): when a new service
  worker is waiting, a **blue stripe** in the slot of the sync stripes ([sync-stripes.md](sync-stripes.md),
  state `update`): `cloud-download`, "**A new version of Ledger Flow is ready.**" and "Reloading takes a
  second. Nothing you saved is lost.", with **Reload** and a **✕** ("Not now"). It does not expire and no toast replaces it. On a device working on this device only it goes before that stripe, which never goes away on its own. The ✕ puts it away until the app is next opened or comes back to the screen (from
  another app, another tab, the lock screen) for as long as that screen still runs the older version; meanwhile Settings ›
  Version says so and has its own Reload ([settings.md](settings.md)). Coming back also looks for a new
  version, so a phone that never reloads the app still finds one. It never reloads on its own. Until
  T-196 it was a five-second toast, which a Saved replaced and which was never shown again: the
  alternatives are on `variants.html`.
- **Confirm your email** (`#confirm-your-email`, T-210): while the account's email is not confirmed —
  a new account, or one from before the app sent email — an **amber stripe** in the slot of the sync
  stripes ([sync-stripes.md](sync-stripes.md), state `verify`, the last in their order): `mail`,
  "**Confirm your email.**" and "You need it to invite people to Shared and to be invited.", with
  **Confirm** and a ✕ ("Not now"). Nothing else waits for it: the account works as it always did, and
  there is no deadline (the owner's decisions 2, 3 and 4 of 2026-09-26). The ✕ is kept in memory only, so
  the stripe comes back the next time the app is loaded from scratch — not every time it comes back to the
  screen, as the new-version stripe does: this one asks something of the person, and asking at every
  return would nag. Meanwhile Settings › Password & email always says it ([settings.md](settings.md)).

  **Confirm opens the sheet "Confirm your email".** Which of its two shapes comes from `/me`, which says
  whether a code is live, when the last one went and when another can go:
  - **A code is live** (`#confirm-email-code`) — right after signing up, or sent in the last 24 hours and
    not used up: "We sent a 6-digit code to **{email}**. It works for 24 hours.", the code field
    ([components.md](../components.md), 37), **Confirm**, and the Resend block of the reset
    ([access.md](access.md)): "You can resend it in 0:42" as plain text, then **Resend code**, and "Not
    there? Check your spam folder. Wrong address? **Change it**", which goes to Profile & security, where
    a mistyped address is corrected.
  - **No code is live** (`#confirm-email-send`) — every account from before email existed, one whose
    code expired or was used up, and one whose first email failed at sign-up: "We'll send a 6-digit code
    to **{email}**." with **Send code** instead.
  - Send code and Resend carry Cloudflare's check, in its place above the button
    (`#confirm-email-human-check`, [access.md](access.md)).
  - **Wrong code** (`#confirm-email-wrong-code`): "That code isn't right. Check the last email we sent."
    A code that stopped working, after 24 hours or five tries: "This code no longer works: it expired,
    or it was tried too many times. Send a new one.", and the sheet turns to its Send code shape. Here the
    two answers can differ: the account is the person's own, so they reveal nothing.
  - **The email didn't go** (`#confirm-email-send-failed`, `EMAIL_SEND_FAILED`): a `danger` alert, "We
    couldn't send the email. Try again in a few minutes." Unlike Forgot your password?, this can be
    said: the address is the person's own. A code that was live before the failure still works.
  - **Busy and failing**: the button's spinner while the request is out; a `5xx` is the `danger` alert
    "Something went wrong on our side. Nothing changed: try again." with the digits kept.
  - **Offline** (`#confirm-email-offline`): the offline stripe takes the slot, so the sheet is opened
    from Settings, or was already open when the connection went; it says "You're offline. Confirming
    your email needs a connection." and its controls are disabled. The plan had the stripe itself say
    it; with one slot, the offline stripe has to win.
  - **Done:** the sheet closes with the toast "Email confirmed", and the stripe and the Settings badge
    go. Confirming from the email's link in another browser does the same here the next time the app
    reads `/me`.
  - **The same sheet confirms a new address** (T-222), titled "Confirm your new email", with "We sent a
    6-digit code to **{new email}**. It works for 24 hours."; its toast is "Your email is now {new
    email}. Every other device was signed out."

- **Toast:** confirms every save, five seconds, with "Undo" where the backend can revert it (create →
  `DELETE`; make main → back to the previous one); no undo on deletions.
- **429:** a `warning` alert with a countdown; in sign-in and sign-up it disables the button.
