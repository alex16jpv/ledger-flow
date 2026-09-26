# Settings

`preview/settings.html`

## The hub (`#settings-hub`)

A profile card (avatar, name, email, last sign-in) that leads to Profile & security, then groups under
eyebrows:

- **Preferences** — Language with its current value; Currency with the code as a badge and the state
  "Locked: you already have accounts" or "You can change it until you create your first account"; Time
  zone; Appearance with palette · mode; **Notifications**, "What reaches you, and where", which opens
  the page specified in [notifications.md](notifications.md); Categories.
- **Security** — Password & email; Active sessions with a count. **While the email is not confirmed**
  (`#settings-email-not-confirmed`), Password & email reads "Your email isn't confirmed yet" with a
  `warning` badge, "Not confirmed". This row is where the confirmation is never hidden: the stripe's ✕
  puts that one away ([states.md](states.md) `#confirm-your-email`).
- **Your data** — the user's rights: access, rectification, erasure and withdrawal of consent; the
  version of the policy accepted and its date; the contact address `ledgerflow@alexpiral.com`; and a
  link to the policy.
- **Data** — **Sync status** with a badge showing the number of queued changes; Export and Import,
  inactive and badged "soon".
- **About** — **Install app**, and "Installed" once it is. **The row no longer hides itself where the
  browser does not offer the prompt**: it used to disappear on iOS and on any browser that never fires
  `beforeinstallprompt`, which is exactly where the user most needs to be told how. **Its wording
  follows the device** (owner, 2026-09-11): on a phone or tablet, "Add Ledger Flow to your home screen
  so the browser doesn't delete what you record offline"; on a desktop, "Install Ledger Flow so the
  browser doesn't delete what you record offline" — a desktop has no home screen, and the app may not
  call it one. **Installed** (`#settings-installed`), the row reads "Installed" and opens nothing. Then
  **Version**, "Ledger Flow · {version}". **While a new version is waiting**
  (`#settings-with-a-new-version`) its line reads "Ledger Flow · {version} · a new version is ready" and
  the row carries a small primary **Reload**: the notice stripe can be closed ([states.md](states.md)
  `#new-version`), and this row is where it is never hidden.

"Sign out" (`POST /auth/logout` with the device's refresh token) and "Delete my account" in red close
the page, with a footer carrying the version and the zone.

**Offline** (`#settings-offline`): "Sign out" is disabled with the line "Signing out needs a
connection: your session lives on the server." The same applies to "Sign out all other sessions".

**Signing out with a queue** (`#sign-out-with-unsent-changes`): the sheet "You have unsent changes",
with a `warning` alert — "n changes haven't reached the server yet. Keeping them means they go out next
time you sign in on this device." — and two ways out: "Sign out and keep them" (primary) and "Discard
and sign out" (`danger`).

**Sheets that write to the server, offline** (`#language-offline`; the same for currency, time zone,
profile and security, and delete account): a `warning` alert on top, "Changing this needs a connection:
it is saved on the server.", and the save control disabled. The sheet can be read, not changed.

## Sync status (`/settings/sync`, `#sync-status`)

Title "Sync status", subtitle "What this device has, and what it still owes the server". In a browser
tab, a `warning` durability alert: "You're in a browser tab. Install the app to keep what you record
offline — a browser can delete it after a few days without opening the site."

Then a list of rows, each with a grey sm tile, a label, help text and a value on the right:

- **Session** comes first — without it, nothing below reaches the server. Help "Your session on the
  server", value "Active". If the session died (`#sync-status-signed-out`), the value becomes "Signed
  out", the help "Signed out on this device, so nothing is syncing", and the row gains the button
  **"Sign in to sync"**. When the user chose to work locally (`#sync-status-this-device-only`), the
  value is "This device only", the help "You chose to keep working here. Nothing is syncing.", and the
  same button.
- **Sync cursor** — "Where the next pull starts from" → "Set" or "Never synced".
- **Last updated** — "The last time this copy caught up with the server" → a date, or "Never".
  **It is not the date of the last full download** (H-11): the mirror stamps it every time it
  drains the change feed, which is what a user asking "how fresh is what I am reading" needs, and
  the label used to promise the other thing.
- **Offline ready** (`#sync-status-preparing`) — help "Your data and the app's screens are on this
  device", value "Ready". While it prepares, "Preparing…" with both halves and their progress,
  "Copying your data and the app's screens · 18 of 25 screens". If something is missing and there is no
  connection: "Incomplete", help "Paused: it needs a connection to finish", and a "Retry" button
  disabled offline. And when the data has landed and every screen is cached but the copy still cannot
  be **read** — the profile row, and with it the time zone every windowed read cuts days on, has not
  arrived — the row says **"Almost ready"**, help "Your data is here but the app still needs one detail
  from the server to read it offline", with a "Finish now" button that asks the mirror for one more
  pass. It is not "Preparing… · 25 of 25 screens": no screen is missing, and a wait with no end is
  what this row exists not to show. The row is fed by `vaultCanAnswer` — the mirror's `syncedAt` **and**
  its profile row — and by the worker's answer about how many entries `app-shell` holds against the 25
  expected.
- **Waiting to send** — the count, with "Last error: {code}" as help when there was one. With the queue
  blocked by an app update (`#sync-status-blocked-queue`), the value is "n · blocked" and the help
  "Blocked by an app update".
- **Sending mode** (`#sync-status-one-at-a-time`) — only when the server has no `POST /sync` and the
  queue goes out one operation at a time: "One at a time", help "This server takes changes one at a
  time, not in one batch".
- **Storage used**, **Persistent storage** and **Running as** ("Installed app" / "Browser tab").

### The three state rows never show a value they do not have (`#sync-status-loading`)

"Sync cursor", "Last updated" and "Offline ready" are fed by the mirror and by the worker's cache, and
neither is ready the instant the screen mounts. Until they are, the value is a **64px skeleton** — not
"Never", not "Preparing…": telling a device that synced yesterday that it never synced is a lie — and
the rows fill in when the fact arrives. **"Never synced" and "Never" are only painted once the mirror
has actually been read and came back empty.**

And the case the design had not considered: **if the app runs without a service worker on purpose** —
it is not registered in development — "Offline ready" does not say "Preparing…" forever, it says
**"Not available"** (`#sync-status-no-service-worker`) with the help "The app's screens are only saved
in the installed app". The row describes the world, not a wait that never ends.

### Persistent storage is not a dead end

The three values stay ("Granted" / "Not granted" / "Unsupported"), but the help tells the truth of each
one. Granted: "Your offline data is safe from the browser's cleanup". **Not granted: "Only installed
apps get it. This browser said no."** — deliberately short, because the row carries a value and a
button, and a long help text splits it into an unreadable column on mobile; the whole explanation lives
in the install sheet — and the row gains the button **"How to get it"**, which opens that sheet.
Unsupported: "This browser can't promise it. Install the app, or keep a connection so nothing waits here
long."

**No button that says "Ask for permission":** the app already asks on its own when it opens the local
copy, and **Chrome never asks the user** — it grants or denies by heuristics — so a button that can do
nothing is worse than a text that explains.

### The rest of the page

A link row, **"Changes that need you"** (an orange `cloud-off` tile, with "n changes are stuck" or
"Nothing needs you") leading to `/sync`. And **"Force full resync"** (secondary, full width) with the
help "Throws away the local copy and downloads it again. Anything waiting to send is kept."; offline
(`#sync-status-offline`) it is disabled with "Needs a connection: it downloads the copy again."; it
confirms in a sheet, "Download everything again?" (`#sync-status-resync`), with "The local copy is
deleted and downloaded again. n changes waiting to send are kept." and the call to action "Resync now";
toasts read "Resynced" and "Could not resync".

### A queue blocked by an app update

When `openVault` returns `outbox: "blocked"` because a pending operation could not be migrated to the
new `opVersion`, Sync status opens with a `danger` alert: "**n changes can't be sent after an app
update.** They were recorded with an older version of the app and this one can't send them. Everything
you record from now on syncs normally.", with the button "See the n changes" leading to the attention
tray. **The app keeps writing normally**: blocking new entries would be worse than not sending the old
ones, and nothing new waits behind what is blocked.

## Install this app (`#install-sheet`, `#install-sheet-samsung`, `#install-sheet-steps…`)

Opened by the **Install app** row in About, by "How to get it" in Persistent storage and by the Home
card's **How** and **Install it here**. It always opens with the `info` alert, "Installing keeps your
offline data safe: the browser stops treating it as something it can delete.", and, **only where the
browser has not granted durable storage**, the line "The app already asked this browser to keep your
data and it said no — browsers don't ask you, they decide, and installing is what changes that."
Where it was granted that line would be false, so it is absent (T-197). Then **three shapes, and the
browser decides which**:

1. **Where the browser offers to install** (`#install-sheet` — Chrome and Edge, on Android and on a
   desktop): the primary call to action **"Install"**, which fires the browser's prompt. On acceptance
   the sheet closes and the row turns to "Installed".
2. **In Samsung Internet** (`#install-sheet-samsung`, T-197): one line saying why — "From Samsung
   Internet, Android flags the app as dangerous: it objects to the way Samsung packages it, not to the
   app. Chrome installs it with no warning." —, the primary **"Install with Chrome"**, which opens this
   page in Chrome, and under it the same fallback as the Home card: "No Chrome, or it didn't open?
   **Install it here**. If Android warns…". Where Samsung has not offered its prompt
   (`#install-sheet-samsung-steps`) the link would do nothing, so the fallback gives Samsung's own
   steps instead: "1. Tap the install icon in the address bar. 2. Or open the menu and choose “Add page
   to”, then “Home screen”.", followed by the warning line.
3. **Where there is no prompt** (every iPhone and iPad, and any browser that never fires the event):
   **the steps with the real name of each thing**, in a short numbered list — **one set per browser,
   and never another's** (owner, 2026-09-11):
   - **iPhone and iPad, Safari** (`#install-sheet-steps`): "1. Tap Share. 2. Choose “Add to Home
     Screen”. 3. Confirm with “Add”."
   - **iPhone and iPad, another browser** (`#install-sheet-steps-ios-other` — Chrome, Firefox, Edge, an
     in-app browser): "1. Tap Share, in the address bar or in the browser menu. 2. Choose “Add to Home
     Screen”. 3. Confirm with “Add”." They all add through the same Share sheet since iOS 16.4, but
     none keeps Share where Safari does.
   - **Android** (`#install-sheet-steps-android` — Firefox, or Chrome before it fires the event): "1.
     Open the browser menu. 2. Choose “Install app” or “Add to Home screen”."
   - **Safari on a Mac** (`#install-sheet-steps-mac-safari`): "1. Open the File menu, or Share. 2.
     Choose “Add to Dock”." It has no address-bar icon, which is what the desktop set would send it
     to look for.
   - **Any other desktop** (`#install-sheet-steps-desktop`): "1. Look for the install icon in the
     address bar. 2. Or open the browser menu and choose “Install Ledger Flow”." Firefox on Windows has
     its own button there; Firefox on a Mac has none, and the closing line is for it.

   And one honest closing line: **"Some browsers don't offer this at all. If yours doesn't, keep a
   connection when you record and nothing will be waiting here."** On iOS with another browser it reads
   instead **"If your browser doesn't offer it, open this page in Safari and add it from there."**,
   because Safari always does.

**What the sheet does not do:** guess the browser to show off. Shape 1 is chosen **only** when the
browser already said it can install — the event arrived —, and outside Samsung Internet. **Which set
of steps is decided by the device and the browser, not by whether the screen is touched:** a Windows
laptop with a touch screen used to be given the iPhone's steps, and an Android without the event was
given them too. **An Android tablet that asks for desktop sites** — Chrome's default on large tablets, which
drops `Android` from the user agent — is still an Android: a Linux user agent with touch points.

**Every path, and where it is drawn** (T-197):

| Device and browser                           | Home card                                            | Sheet                                          |
| -------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Android, Chrome                              | Install (`#install-card-safe`)                       | `#install-sheet`                               |
| Android, Samsung Internet                    | Install with Chrome (`#install-card-samsung`)        | `#install-sheet-samsung`, `-steps`             |
| Android, a browser without the event         | How (as `#install-card`)                             | `#install-sheet-steps-android`                 |
| Android tablet asking for desktop sites      | as its browser above: told apart by its touch points | as its browser above                           |
| iPhone and iPad, Safari                      | How (`#install-card`)                                | `#install-sheet-steps`                         |
| iPhone and iPad, another browser             | How (as `#install-card`)                             | `#install-sheet-steps-ios-other`               |
| Desktop, Chrome or Edge                      | never                                                | `#install-sheet`                               |
| Desktop, no event (Firefox, Safari on a Mac) | never                                                | `-steps-desktop`, `-steps-mac-safari`          |
| Already installed                            | never                                                | the row says Installed (`#settings-installed`) |
| Dismissed                                    | hidden by the P-46 pauses ([home.md](home.md))       | unchanged: the row is always there             |

## The rest of the screens

- **Language** (`#language`): three rows with a check — Follow device (uses `navigator.language`,
  falling back to English), English (default), Español. It changes instantly without a reload, with a
  note that dates and amounts follow the language, the currency and the zone.
- **Appearance** (`#appearance`): a segmented control for Light / Dark / System; palette cards with five
  sample dots (brand plus four seeds) and a check on the active one; a live preview. Persisted locally,
  immediately.
- **Active sessions** (`#active-sessions`): an explanatory alert (30 days), rows with an icon per user
  agent (smartphone, laptop, monitor), "This device" for the current refresh family or a "Sign out"
  button (`DELETE /auth/sessions/:id`, idempotent), last activity and expiry; and "Sign out all other
  sessions" (`POST /auth/logout-all`) — the confirmation warns that this device will have to sign in
  again too. **Below 600px the row's three facts do not fit on one line**, so the activity takes its
  own line and the two dates share the next one, with no dot between them and the row's own dot only
  from 600px up; and "Sign out" becomes icon-only, keeping the device in its accessible name. Nothing
  in the row is ever truncated: measured at 375px, the three facts on one line showed 73% of their
  text each.
- **Profile & security** (`#profile-and-security`): name, email (help: it signs out other sessions), a
  new password, a re-authentication alert and a required "Current password" field when the email or the
  password changes; `CURRENT_PASSWORD_INVALID` shows inline; success brings a toast and a token refresh.
  **An email not confirmed** (`#profile-and-security-not-confirmed`) carries a `warning` badge, "Not
  confirmed", beside the field's label — inside the field it would collide with a long address —, and
  the help "Confirm it to invite people to Shared and to be invited.
  **Confirm it**", which opens the code sheet of [states.md](states.md).

  **Until T-222, a new email saved here is not confirmed**: the change goes through as it does today, but
  the account's email turns unconfirmed, a code goes to the new address, the toast reads "Check {new
  email}: confirm it to use invitations in Shared", and the stripe comes back. Otherwise confirming one
  address and then switching to somebody else's would carry the confirmation over.

  **From T-222 a new address counts only once it is confirmed** (`#profile-and-security-pending-email`).
  The field's help becomes "A new address gets a code first: the change happens once you confirm it, and
  then your other sessions are signed out." Saving a new one — with the current password, as now, and
  Cloudflare's check ([access.md](access.md)) — leaves the field on the current address, shows the toast
  "Check {new email}: your email changes once you confirm it", and puts a card under the field: a `mail`
  tile, "Waiting for confirmation at **{new email}**", "We sent it a code and a link. Until it's
  confirmed, your account keeps {email}.", and **Enter code** (the code sheet, for the new address),
  **Resend** (with its countdown and Cloudflare's check) and **Cancel change**. The card goes when the
  address is confirmed, here or from the link, when it is cancelled, or when its 24 hours pass, and then
  the change is dropped. Saving another new address while one is waiting replaces it, and the first
  one's code and link stop working.

- **Currency and time zone** (sheets): a searchable list of ISO 4217 codes with local names; when
  locked, a read-only sheet with the `CURRENCY_LOCKED` explanation. Time zone: a searchable IANA list
  with offsets; saving refreshes the token so budgets and stats use the new one immediately.
- **Delete account** (`#delete-account`): a `danger` alert with the guarantee that the data is kept and
  the account comes back by signing up again with the same email and this password, a **Current
  password** field (help "So nobody else can delete your account.") and a solid `danger` button,
  disabled until the field has something. The password is the confirmation: a stolen session cannot
  delete the account (T-153). A wrong one (`CURRENT_PASSWORD_INVALID`, `#delete-account-wrong-password`)
  is an error under the field. `DELETE /users/:id` leads back to sign-in with a message.
