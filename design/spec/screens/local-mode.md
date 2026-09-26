# Local mode

`preview/local-mode.html`

What the app does when the session dies but the device still holds a copy of the data.

## How the app behaves without a session (`#sign-in-to-sync`)

If the refresh token is dead **but the device has a vault for that user**, the app **opens anyway**: it
reads from the local copy and queues writes. The session sheet changes identity: the title becomes
**"Sign in to sync"**, with a `warning` alert — "Your session ended, so nothing is syncing. The app
keeps working on this device and your changes are saved here — sign in again to send them." — and the
call to action "Sign in to sync". It is **dismissable**: a dead session cannot be a wall while the app
works. It is **not shown while there is no connection**, because signing in is impossible then. On
re-authentication the app checks it is the same user before touching the copy. With no vault, the
blocking sheet of [states.md](states.md) still applies.

**How to get back to it once dismissed**, in two fixed places, neither of them "Sign out": the
`signedout` stripe, which is the main one because it is seen without going to look for it and because
the stripe is already where the state of the connection and the queue lives; and the **Session** row of
Settings › Sync status, which on that screen is not optional — if it says what the device owes the
server, it has to say there is nobody to talk to. They do not compete: the stripe warns, Sync status
answers whoever goes to look.

**The sheet really closes.** Closing means the app stays in local mode and the stripe remains as the
reminder — not a wall with another door.

## Coming back without a session: three exits (`#three-exits`)

> Until now, a device with a local copy and a dead session fell into local mode: the app opened and a
> sheet invited the user in. That leaves out two things the user needs to be able to say: **"I don't
> want an account, I want to keep working here"** and **"delete what this device is holding"**. So the
> sheet became **a decision with three exits**, and none of the three is a dead end.

- **When it appears.** When the refresh is dead (`REFRESH_INVALID` / `REFRESH_REVOKED`) or a cold start
  cannot resolve the session, **and the device has a copy for that user**. With no copy, the blocking
  sheet still applies: there is nothing to keep and nothing to keep working with. **It is not shown
  offline**: the app opens in local mode and the `offline` stripe rules — asking when the main answer
  needs a connection is a wall. The two exits that do work offline also live in fixed places, so they
  are not lost.
- **The sheet.** Title **"This device has your data, but no session"**. A `warning` alert: "Your session
  ended. The app keeps working here and your **n changes** are saved on this device — they just aren't
  going anywhere." Below it, **three exits in order of recommendation**, each with a line saying what
  happens if it is chosen:
  1. **"Sign in to sync"** (primary, `log-in`) — "Sign in and everything saved here goes to the
     server." It is today's flow, and it **keeps the route** to come back to.
  2. **"Continue on this device only"** (secondary, `cloud-off`) — "The app works the same and nothing
     leaves this device. **If you change browser or clear the site's data, this can't be recovered.**"
     The warning goes on the same line, not in a separate sheet: it is the consequence of pressing, not
     a footnote.
  3. **"Delete everything on this device"** (ghost, `--danger` text, `trash-2`) — "Deletes the local
     copy and its n unsent changes. Your account on the server is not touched." It **confirms in a
     sheet**.

  **The sheet cannot be closed without choosing** — one of the two in the app that are not dismissable,
  and that is why the three exits have to be complete: closing it without deciding would leave the user
  in exactly the ambiguous state this is meant to remove. Tapping outside or pressing `Escape`
  **underlines** the three options (with no animation under `prefers-reduced-motion`) instead of
  closing. **That nudge has never been built**: today both do nothing at all, and since T-75 made a tap
  outside close every other sheet, this is the one place where a tap outside is silently refused. It is
  its own task.

## Confirming the deletion (`#delete-local-copy`)

The sheet **"Delete everything on this device?"** with a `danger` alert: "This deletes the copy of your
data on this device and **n changes that only exist here**. It does not delete your account: signing in
again downloads everything the server has." With an empty queue the sentence loses its second half — "n
changes that only exist here" is never shown with a zero — and reads "This deletes the copy of your data
on this device." The call to action is a solid `danger` **"Delete everything"**, with a ghost "Cancel".

**With another account's changes waiting here** (`#delete-local-copy-another-account`): the deletion
takes every copy in the browser, so it also takes the unsent changes another account left when someone
else signed in (see [Another account signs in](#another-account-signs-in-another-account-signed-in)).
The sheet counts them apart and adds one sentence: "It also deletes **n unsent changes from another
account** that signed in on this browser." Nobody deletes someone else's work without being told
(owner, 2026-09-26). It says how many, never whose: no name or email of the other account.

On confirmation the copy, the queue and **the device's session marker** are deleted, and the app goes to
sign-in with the toast "Everything on this device was deleted". **The marker is not a detail:** it is
what stops the device from insisting on opening the copy of a user the server no longer has.

**Everyone sees the deletion**, not just development. The case is not only a database wiped locally: it
is an account that no longer exists, a borrowed device, or a browser someone wants to leave clean. A
control that only exists in development is not there when it is needed.

## "This device only" is a choice, and it stays

Different from the local mode above, which is a _consequence_ of having no session: here the user chose
it, so it **survives reloads** until they change it, and **it is not asked again**. It is stored on the
device, next to the marker. While it is on:

- **What it cuts:** all data traffic. No read and no write goes out to `/api`; the screen reads from the
  mirror and whatever is recorded enters the queue, exactly as offline. **What it does not cut:** the
  app's documents and JavaScript, which keep being requested — so the app can update itself, and a
  screen this device never opened can still be opened. Cutting everything would freeze the app on
  whatever version it happened to have.
- **The stripe:** the seventh state, `localonly`, described in
  [sync-stripes.md](sync-stripes.md#the-seven-states).
- **How to leave it:** through the stripe's action, and through **Settings › Sync status**, whose
  **Session** row turns to "This device only" with the help "You chose to keep working here. Nothing is
  syncing." and the button "Sign in to sync". That same screen is where **"Delete local data"** lives,
  the second exit that works offline, inside **Your data** and with the same confirmation sheet. With
  that, the two exits that need no connection exist **always**, not only in the moment the sheet
  appears.
- **On signing in again:** the app checks it is **the same user** before touching the copy, the queue
  goes out on the first pass, and the stripe turns `online` with its "n changes synced" counter. If it
  is **another** user, the previous one's copy is not mixed in: see
  [Another account signs in](#another-account-signs-in-another-account-signed-in).

## Another account signs in (`#another-account-signed-in`)

A device can hold more than one person's copy: someone's session ends, and someone else signs in on
the same browser. **Whoever signs in, nobody else's copy stays on the device**: the moment the sign-in
(or a new account) succeeds, every other account's accounts, transactions, budgets and Shared are
deleted from this browser. They are a copy of the server, so that person loses nothing: their next
sign-in downloads them again.

**Their unsent changes stay, and nobody is asked.** They wait on this device, out of sight, and go out
by themselves the next time that person signs in here — the same as "Sign out and keep them". The
person signing in is never shown them or asked about them: it is not their work to keep or throw away,
and they are not told another account left anything behind until they choose "Delete everything on
this device", the only way to delete them, whose confirmation counts them (see
[Confirming the deletion](#confirming-the-deletion-delete-local-copy)).

**The account that signs in starts at Home**, even when it signed in from the previous account's
session sheet, whose "Sign in to sync" keeps that account's screen to come back to: that screen was
never the new account's.

**A tab still open on the previous account moves to the one that signed in.** The browser's session is
the new one now, so that tab is too: it goes to Home of the account that signed in and shows the toast
**"Another account signed in on this browser"**. It moves as soon as the other sign-in happens, or
the next time the tab is looked at if it could not hear about it; nothing of the previous account stays
on screen. When it is **the same** person who signed in again from another tab, a tab that was showing
the session sheet or the stripe of a dead session simply comes back to life, with no toast.

## Projected figures (`#projected-figures`)

Every amount, balance, `spent`, percentage or bar that already includes a write the server has not
confirmed carries the amber projection mark, and says why on hover or focus. The per-row equivalent is
the "Pending sync" badge. A projection is never painted as a figure the server sent.

## The offline fallback document (`#offline-document`)

A static page per language that the service worker serves when, with no connection, a route **this
device never opened** is requested and there is no cached document. No app CSS and no fonts: system
type, `color-scheme: light dark`, centred. The copy: "You're offline." · "This screen has not been
opened on this device yet, so there is nothing saved to show." · a "Try again" link. (ES «Sin
conexión.» / «Esta pantalla aún no se ha abierto en este dispositivo, así que no hay nada guardado que
enseñar.» / «Reintentar».) The app's 18 static routes and the detail templates are precached on
signing in, so in normal use this page is almost never seen.
