# Notifications

`preview/notifications.html` · route `/notifications` · Settings › Notifications at
`/settings/notifications` (`preview/settings.html`)

What you would otherwise not see: somebody invited you to a shared group, somebody answered your
invitation, somebody changed a group you are in. Budget alerts will be new rows of this same
inbox, never a second one. How the server keeps them — the types, the states, how long they last — is
the backend's `docs/modules/notifications.md`; this file is what the person sees.

**Nothing interrupts.** A notification never opens a toast, a sheet or a sound, and never covers what
the person is doing. Arriving is a count and a dot, and the inbox is where it is read. Push, when it
exists, is the one channel that reaches somebody outside the app, and only somebody who switched it on.

## How it arrives (`#arriving`, `#more-sheet-with-news`)

Three places, the owner's choice of 2026-09-22 over a bell on every screen and over no bell at all:

- **The bell in Home's header**, at every width, between search and the avatar. With something unseen
  it carries a solid brand count ("2", "9+" past nine) and its accessible name becomes
  "Notifications, 2 new"; with nothing, it is the bare bell, "Notifications". It leads to the inbox.
- **Below 900px, a dot on More** while anything is unseen — the tab is then named "More, new
  notifications", so the dot is never only a colour — and inside the sheet a **Notifications** row,
  after Shared, whose line says "2 new" or "Nothing new".
- **From 900px, a Notifications row in the sidebar**, right after Transactions, with the count beside
  it, read as "2 new".

In **This device only** mode the three are still there, bare: no count, no dot, and the inbox says why
(see _States_).

**The two dots never share a colour.** The amber dot on Transactions is the person's own entries
waiting for review — amber is "pending" across the product. The notifications dot and count are
**brand**: news from somebody else, not work the person left undone. They can both be on at once.

The count is **what is unseen**: it clears when the inbox is opened, not when each row is read. It is
derived from the device's copy, so it is right offline and never waits for a request, and it counts
only rows the inbox would show (see _What is never shown_).

## The inbox (`#inbox`)

A top-level destination, like Shared: the title "Notifications" and, on the right, **"Mark all as
read"** (ghost). Below 900px the More tab carries the selected look while it is open.

- **Newest first**, by when the last thing happened. What was unseen when the page opened sits under
  **New** for this visit and the rest under **Earlier**; opening the page is what marks them seen and
  clears the bell, so coming back shows them under Earlier.
- **A row** is the tile of what it is about, one sentence, and when. The sentence is written by the app
  in the person's language from the facts the row carries — names in the weight of the text, never in
  colour. The tile: `users` in the group's colour for anything about a group, `circle-check` green for
  an invitation accepted, `x` grey for one declined.
- **Unread** rows are in the full text colour with the names in semibold, and carry a brand dot on the
  right; the link itself starts with a hidden "Unread:", so a screen reader hears it wherever it meets
  the row, and it is never colour alone. A read row steps back to the secondary text colour.
- **Opening a row** — its sentence is the link — marks it read and goes to what it is about: the group
  for its activity, or for an invitation you accepted, or for an answer to one of yours that was
  accepted. **A row with nowhere to go is not a link**: an invitation still waiting (its answers are
  right there), one you declined or that is no longer available, an answer that declined, and anything
  about a group you can no longer open. None of them ever lands on a missing page. An invitation
  waiting for you is read when you answer it, or with "Mark all as read".
- **An invitation waiting for you** carries its two answers under the sentence, **"Decline"** (ghost)
  and **"Accept"** (primary). Once it is answered — here or on any other device — or it stops being
  available, the buttons go and a badge says how it ended: `Accepted` (`success`), `Declined`
  (neutral), `No longer available` (neutral). What answering does, and what it shows while it waits
  for the server, is the invitation's own design in Shared (T-129), where invitations are answered
  until this inbox exists; this row offers the same two answers.
- **At the foot**, a row to **Notification settings**.
- **What arrives while the inbox is open** comes in at the top, under New, and counts as seen at once:
  it is on screen, and the bell is not.

### Folded (`#folded`)

Changes to the same group fold into one row while it is unread. The row says how many — "3 changes
in **Night out**" — and the latest in its second line — "Latest: Beto Cano recorded a payment ·
Yesterday 21:40" — and rises to the top as unseen again. A single change reads as itself, "**Beto
Cano** added an expense to **Night out**". Once the row is read, the next change starts a new one.
Eight expenses on a trip are one row, never eight.

### What is never shown

- **A row the server has let go.** Every row carries the date it expires — 90 days after the last
  thing it tells happened, 30 days after an invitation was answered, and never while one still waits
  — and past it the app stops showing it and removes it from the device by itself.
- **A topic switched off in the app.** What arrives while it is off is kept for the other channels and
  never shown here, nor counted.
- **A kind of notification this version of the app does not know.** It cannot write a true sentence
  about it, so the row is left out, and so is its count: the bell never counts what the inbox does not
  show.

## States

- **Empty** (`#inbox-empty`): the outlined bell tile, "You’re all caught up", "When someone invites you
  to a shared group, or changes one you’re in, it shows up here.", and "Notification settings".
- **Loading** (`#inbox-loading`): four skeleton rows and a skeleton where "Mark all as read" goes.
- **Error** (`#inbox-error`): only reachable by a device that holds no copy yet and asks the server —
  "We couldn’t load your notifications", the status, "Retry" and the reference. Once the copy is
  there, the inbox reads from it and this state cannot happen.
- **Offline** (`#inbox-offline`): the offline banner says "These are the notifications this device
  already has. New ones arrive when you’re back online." Everything reads as usual, and marking as read
  — one row or all — still works: it waits in the queue like any other change and the bell clears at
  once. Notification settings can be opened and read, not changed.
- **This device only** (`#inbox-this-device-only`): working without the account, nothing from other
  people can arrive. The outlined `cloud-off` tile, "Notifications need your account", "You’re working
  on this device only, so nothing from other people can reach you here.", and "Sign in to sync". Not an
  empty inbox: an empty inbox would say there is nothing, and the truth is that nothing can come.

**When they arrive.** They come down with everything else when the app catches up with the server — on
opening, on coming back to it after a few minutes, and when the network returns — never on a timer.
An invitation sent while the app is open shows up on the next of those.

## Settings › Notifications (`#notification-settings`, `#notification-settings-offline`)

Reached from **Preferences › Notifications** in Settings ("What reaches you, and where") and from the
foot of the inbox. A back header, "Notifications", and the line "Choose what reaches you. Switching
something off stops what comes next; what already arrived stays."

One group per area, headed by its eyebrow ("Shared groups") with the channel named on the right, and
one row per topic with **one switch per channel that exists**. Today that is only **In the app**; email
and push each add their column when they are built, and until then nothing on the page mentions them.

- **Invitations** — "When someone invites you to a shared group." **No switch**: in its place "Always
  on", and a `lock` line, "An invitation you never see can’t be answered." A control with one answer
  is not drawn (as in the new-group form, 2026-09-21).
- **Activity** — "Answers to your invitations, and expenses and payments other people record in
  groups you’re in." On by default.

The switch's accessible name carries the channel ("Activity in the app"), because the channel is only
written once, above the list. The preference is saved on the server with the profile, so offline the
page can be read and not changed: the `warning` alert "Changing this needs a connection: it is saved
on the server." and the switches disabled — the same rule as every other Settings sheet.
