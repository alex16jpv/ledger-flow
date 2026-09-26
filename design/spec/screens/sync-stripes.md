# Sync stripes

`preview/sync-stripes.html`

The **amber stripe** (`--warning-soft` / `--warning`) sits at the **top edge of the content column**:
the first element of `main`, above the page header, as wide as the content and flush with the edge of
the screen. On desktop it never covers the sidebar. It is `position: sticky`. It pushes the content
rather than hiding it, with a `wifi-off` icon, the text "You're offline. Changes are saved on this
device and will sync when you're back online." and the counter "n changes waiting".

Amber was chosen because it already means "incomplete" everywhere in the app; red is kept for what needs
the user.

## The nine states

1. **`offline`** (`#offline`) — no connection. A badge on each transaction saved locally, and a toast.
2. **`pending`** (`#waiting-with-a-connection`) — with a connection and a queue that has not drained:
   `cloud-off`, "Changes waiting to sync. They are saved on this device." plus the counter. **It is not
   painted until the queue has spent a whole second undrained** (`PENDING_GRACE_MS`): with a connection
   a write reaches the server in about 30ms, and painting it in that gap turned every save into a flash
   of a pattern that pushed the content 55px down and back up — a false warning, because the user has
   nothing waiting; that is the round trip. **The exception: if the queue already came back with a
   failure, it is painted immediately**, with no grace. The wait lives in a constant so it can be raised
   if the flash returns on a bad connection, or lowered to announce a real wait sooner.
3. **`online`** (`#back-online`) — green and transient, about three seconds: "Back online." **with the
   counter "n changes synced"** as a second line. It closes the circle the amber stripe opened — "2
   changes waiting" becomes "2 changes synced" — and it is the only confirmation that the queue emptied.
   **The line is not painted when nothing drained**: never "0 changes synced"; in that case the stripe
   stays at a plain "Back online."
4. **`error`** (`#needs-attention`) — red and `role="alert"`: "Some changes need your attention." plus
   "n changes could not sync", with **"Review"** (which opens the first conflict) and **"See all"**
   (which goes to `/sync`).
5. **`signedout`** (`#signed-out`) — amber with `log-in`, **permanent while it lasts**: "**You're signed
   out. Nothing is syncing.**" plus "n changes are saved on this device", with the action **"Sign in to
   sync"** (→ `/login?reauth=1`). ES «**Cerraste sesión. No se está sincronizando.**» + «n cambios
   guardados en este dispositivo» + «Iniciar sesión para sincronizar».
6. **`blocked`** (`#blocked-by-an-update`) — red and `role="alert"`: "**An app update stopped n changes
   from being sent.**" plus "They are still saved on this device.", with the action **"See them"** (→
   `/sync`).
7. **`localonly`** (`#this-device-only`) — amber with `cloud-off`, permanent and **neutral in tone,
   because it was a decision and not a failure**: "You're working on this device only." plus "n changes
   are saved here" plus the action **"Sign in to sync"**. It never says "signed out" or "nothing is
   syncing": that is `signedout`, which describes a session that died on its own.

8. **`update`** (`#new-version` on [states.md](states.md)) — **blue** (`--info-soft` / `--info`), the one
   stripe that is good news: a new version of the app is waiting. "**A new version of Ledger Flow is
   ready.**" plus "Reloading takes a second. Nothing you saved is lost.", with **"Reload"** and a ✕ that
   puts it away until the app is next opened or comes back to the screen. ES «**Hay una versión nueva de
   Ledger Flow.**» + «Recargar tarda un segundo. No se pierde nada de lo que guardaste.» + «Recargar».

9. **`verify`** (`#confirm-your-email` on [states.md](states.md)) — **amber** with `mail`, while the
   account's email is not confirmed: "**Confirm your email.**" plus "You need it to invite people to
   Shared and to be invited.", with **"Confirm"**, which opens the code sheet, and a ✕ that puts it away
   until the app is next loaded from scratch. ES «**Confirma tu correo.**» + «Lo necesitas para invitar a gente en
   Shared y para que te inviten.» + «Confirmar». It is amber because something about the account is
   incomplete, which is what amber says everywhere else.

**Priority when several apply** — only one is painted:

```
localonly → offline → blocked → signedout → error → update → pending → online → verify
```

`localonly` comes first because the app then behaves exactly as it does with no network (P-32): saying
"offline" would describe the effect and hide the decision behind it. Otherwise, with no connection
nothing can even be attempted, so `offline` wins. A queue blocked by an update is not fixed by signing
in, so it comes next. `localonly` and `signedout` cannot coincide. With a dead session or a
blocked queue, resolving conflicts achieves nothing yet, so both go before `error`. `update` waits behind everything the user has to act on, and goes before `pending` and `online`, which only describe something that is resolving itself. `verify` goes last: it is a request with no hurry and it lasts until it is answered, so placed any higher it would hide, for whoever never closes it, the stripes that say what is happening to their changes. It never meets `localonly` or `signedout`, because it needs a session to be true. **The one exception is `localonly`**: it lasts until the user leaves the mode, so `update` goes before it, and once closed with ✕ the slot goes back to `localonly`.

## What travels with the stripe

- Every transaction with a queued write carries the `warning` badge "Pending sync" (`cloud-off`) beside
  its title, and the metadata "Saved on this device". If its operation is in conflict or was refused,
  the badge becomes `danger` **"Needs attention"**.
- The toast when saving offline reads "Saved on this device · syncs when online".
- **Every figure or bar that includes unconfirmed writes carries the projection mark**, described in
  [local-mode.md](local-mode.md).
- The writes that cannot wait in a queue — language, currency, zone, profile, deleting the account,
  signing out, restoring the default categories — are disabled offline and say why. Restoring the
  defaults is the exception: its button is hidden.
- Reads come from the local copy; writes go into the queue with their own `opId`.

## Ready to use offline (`#ready-for-offline`)

A toast, shown **once per device**, when the copy and the app's screens are both on the device: "Ready
to use offline" with the action "What this means". It was deliberately kept out of the stripe: the
stripe is for what is going wrong, and its green is already taken by "Back online".
