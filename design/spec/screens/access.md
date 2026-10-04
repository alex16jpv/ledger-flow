# Access

`preview/access.html`

- **The frame:** a centred card, 440px at most, the brand on top, an h1 plus one line of context, the
  form, a 48px call to action, and the link that swaps sign-in for sign-up. No tab bar and no sidebar. A
  **language chip** (`globe` plus "EN" / "ES") sits to the right of the brand in sign-in, sign-up and
  onboarding: it changes the screen's language instantly, before an account exists.
- **Sign in** (`#sign-in`): email, password with show/hide (`eye`), and "Forgot your password?", which
  opens [its flow](#forgot-your-password-forgot) with the email carried over when one was typed. A
  deployment with no Cloudflare site key cannot run [the check](#cloudflares-check), so there the link
  stays inactive with "(soon)", as it was before the app sent email, and `/forgot` and `/reset` do not
  exist. A 401
  shows a `danger` alert, "Wrong email or password" — one message, never revealing which half failed. A
  429 (`#sign-in-rate-limited`) shows a `warning` alert with a countdown computed from `Retry-After` or
  from the 15-minute window, and the button stays disabled while it runs.

  **The right password of a deleted account** opens [Restore your account?](#restore-your-account)
  instead of signing in, and **an account from before email existed, past its deadline**, opens
  [Confirm your email to continue](#confirm-your-email-to-continue). A wrong password reads the same
  "Wrong email or password" whatever the account is: nothing on this screen says that an address has an
  account, a deleted one or none. **After Delete my account** the app lands here with an `info` alert
  (`#sign-in-after-deleting`), "**Your account was deleted.** It's kept until October 28, 2026: signing in
  before then restores it."

  **On a device that already holds someone's data the email arrives written** and the focus goes to the
  password, which is the only thing missing (P-37): coming back to sync is not a first sign-in, and the
  screen must not ask for what the device already knows. It stays an ordinary editable field, so another
  account can still sign in here; it is filled from the profile the mirror keeps, so it works with no
  network, and a device with no vault — a first sign-in, or one after "Delete everything on this
  device" — gets the empty field. Nothing else about the screen changes: the plate above is that state.

- **Sign up** (`#create-account`): name, email, password (help: "between 8 and 128"), a **required
  consent checkbox** ("I agree to the Privacy policy and to the processing of my personal data (Ley
  1581)", with links; the button is disabled until it is ticked), **language** (a "Language" picker row
  showing what `navigator.language` detected: "Detected from your device" and "English"; help: "The
  language of your account. You can change it any time in Settings."; it opens a sheet with **English**
  and **Español**, without "Follow device" — that is a local mode of Settings, not a value of the
  contract — and the note "The whole screen changes right away. Dates and amounts follow this language,
  your currency and your time zone."; the frame's chip and this row **are the same value**: changing
  either changes the other, and whatever is set on submit is the registration's `locale`), the currency
  (a picker with what `Intl.NumberFormat().resolvedOptions()` detected, with help explaining the later
  lock) and the time zone (a picker with `Intl.DateTimeFormat().resolvedOptions().timeZone`).

  **Create account creates nothing yet** (the owner's decision 16 of 2026-09-28): it sends the code, and
  the account exists once that code is typed, on [its step](#finish-creating-your-account). What was
  typed waits on the server for 24 hours, and a new Create account with the same address replaces it.
  **It answers the same for every address**, so it never tells who has an account: when the address
  already has one, live or deleted, the step reads exactly the same and the inbox gets
  `account-exists` instead of the code ([emails.md](emails.md)). So there is no "email taken" error any
  more, and a deleted account is not brought back from here: that is Sign in's job. A `5xx` is the
  `danger` alert "Something went wrong on our side. Nothing was created: try again.", with everything
  typed kept.

  **Creating an account needs [the check](#cloudflares-check)**: the server creates none without it. A
  deployment with no Cloudflare site key, such as a preview, cannot run it, so there the screen opens
  with a `warning` alert on top (`#create-account-unavailable`), "**You can't create an account
  here.** It needs Cloudflare's check, which this version of the app doesn't have.", and **Create
  account** stays disabled. The links that lead here do not change.

- **Onboarding 1 · first account** (`#onboarding-first-account`): step dots on top; name, type (**the
  same `picker` row as the account form**, not chips), an optional current balance (sent as `balance`,
  kept as `openingBalance`) and a colour, drawn at random like every create form
  ([color.md](../color.md)). The copy says it will be the main account.
- **Onboarding 2 · a ceiling for the month** (`#onboarding-monthly-ceiling`): the amount with three
  suggestions, an explanation of the global budget, and "Create budget" (`POST /budgets` with
  `categoryIds: []`, `periodType: MONTHLY` and a colour drawn at random, since this step shows no
  swatches) or "Not now". Both steps can be picked up again from Home
  if they are skipped.

## Finish creating your account

`#create-account-code`, `#create-account-wrong-code`, `#create-account-expired`, `#create-account-taken`

The step after Create account, in the same frame and at the same address, so a reload lands on it again
for as long as its 24 hours run.

- "Check your email" and "We sent an email to **{email}**. Type the 6-digit code in it to finish creating
  your account.", then the code field ([components.md](../components.md), 37), **Create account**, and
  the Resend block of Forgot your password? below: the countdown, **Resend code** (with [the
  check](#cloudflares-check)), and "Not there? Check your spam folder. Wrong address? **Change it**",
  which goes back to the form with everything in place except the password.
- **The same words for every address.** "We sent an email" is true for both: the code, or
  `account-exists` for an address that has an account. **Every bad code gets the one answer**
  (`#create-account-wrong-code`), the reset's: "That code doesn't work. It may be mistyped, out of date or
  replaced by a newer one: check the last email we sent, or ask for a new code." — with two answers,
  "expired" would only exist for the addresses without an account. Create account waits until the code
  changes.
- **The email's button** finishes it too, in any browser (`/verify`, [below](#pages-reached-from-an-email)),
  but it signs nobody in: that browser proved the inbox, not the password. The code step, still open
  here, then signs in with the same code, because confirming twice changes nothing — but only in the
  browser that holds the pending sign-up, the one where the password was typed: the code alone never
  signs anyone in.
- **Done:** the account exists and this device is signed in with its device token, so onboarding opens
  and no `new-sign-in` is sent. Busy, failing, offline and too many requests read as in Forgot your
  password?, and **a send that failed is never shown** on Create account or on Resend, for the same
  reason: only the branch with no account could fail differently. Whoever waits for a code that does
  not come has Resend, and "Not there? Check your spam folder.".
- **A sign-up that is over** (`#create-account-expired`): Resend code answers `SIGN_UP_EXPIRED` when its 24
  hours passed or a newer Create account with the same email replaced it. The step goes back to the form
  with the email in place and a `warning` alert, "**That sign-up is over.** It lasts 24 hours, and a
  newer Create account with the same email replaces it. Fill in the form again to get a new code." A
  reload after the 24 hours lands on the plain form, because the browser forgot the sign-up with them.
  A code typed for a sign-up that is over is a bad code like any other.
- **The email has an account now** (`#create-account-taken`, `EMAIL_TAKEN` on the code): another account got the
  address between Create account and the code — only whoever holds the code can learn it. The step goes back
  to the form with the email in place and a `warning` alert, "**That email has an account now.** It was created
  while you were waiting for your code. Sign in with it, or use another email here."

## Restore your account?

`#restore-your-account`

After Sign in with the right password of an account deleted in the last 30 days (the owner's decision
20). A step of the frame, not the app: nothing of the account opens before the answer.

- An `archive-restore` tile, "Restore your account?" and "You deleted this account on **September 28,
  2026**. It's kept until **October 28, 2026**, and then erased for good." Then "Restoring brings back
  everything in it, as it was. The shared groups you left when you deleted it stay left."
- **Restore account** (primary) signs in and opens Home with the toast "Account restored", and the inbox
  gets `account-restored` ([emails.md](emails.md)). **Not now** goes back to Sign in and the account stays
  deleted, with its date unchanged.
- The two dates come in the answer to the sign-in, which only a right password gets, so they tell nothing
  to anyone who does not already hold the account.
- **Busy, failing and offline** read as in Forgot your password?: the button's spinner, the `danger`
  alert for a `5xx` with nothing restored, and offline the `warning` alert "You're offline. Restoring
  needs a connection." with the button disabled.
- **The copies on devices.** Delete account removes this device's copy as signing out does, keeping
  what it had not sent the way "Sign out and keep them" keeps it ([settings.md](settings.md)). Another
  device that was offline keeps recording into its queue; when it reconnects its session is gone, Sign in
  comes first, and this step decides: Restore account sends the queue, **Not now** leaves it on that
  device, as after any sign-out, until the account is restored there or the device's data is deleted.
  After the erasure nothing can take it: the queue waits and says it can't be sent, and only "Delete
  everything on this device" clears it.

## Confirm your email to continue

`#confirm-email-required`, `#confirm-email-required-code`

For an account from before email existed that did not confirm by its deadline (the owner's decision 17:
14 days from the email that announced it, [states.md](states.md) `#confirm-your-email`). **Its data is
untouched**: this is only the door. It lives at `/confirm-to-continue`, in this frame. After Sign in, and whenever an open app learns it from `/me`, the
frame shows this step instead of the app, and the app opens nothing of the account until it is done.

- "Confirm your email to continue" and "Ledger Flow now asks every account to confirm its email. Nothing
  in your account has changed: once you confirm, you're back in." Then "We'll send a 6-digit code to
  **{email}**." and **Send code** (with the check), which turns the step into the code shape
  (`#confirm-email-required-code`): the code field, **Confirm**, and the Resend block — the same words as
  the sheet of [states.md](states.md), whose rules for a wrong or used-up code, a failed send and too
  many requests apply here as they are.
- **"Wrong address? Change it"** turns the step into a form of its own
  (`#confirm-email-required-change`): "Use another email", the new address and **Current password**, and
  **Send code**, which asks for the change as Profile & security does ([settings.md](settings.md)) and
  answers the same way for every address; its code step is this step's code shape for the new address,
  and confirming it confirms the account. Its errors are Profile & security's. Under everything, **Sign
  out**, which with changes waiting on the device opens "You have unsent changes" first
  ([settings.md](settings.md) `#sign-out-with-unsent-changes`).
- **Offline**, a device that already holds the account's copy opens it as always, because it cannot know
  about the deadline until it reaches the server; what it records waits in the queue. The first time the
  server answers, this step takes over and says, when the queue has something, "**3 changes on this
  device** are kept and sync once you confirm." Nothing is lost and nothing is sent before.

## Forgot your password? (`/forgot`)

- **Asking** (`#forgot-password`): the frame of Sign in; "Forgot your password?", "Type your account's
  email and we'll send a code to it so you can choose a new password.", the email — carried over from
  Sign in when one was typed there, empty when arriving from an email's `/forgot` link
  —, **Send code** and "Back to sign in". [Cloudflare's check](#cloudflares-check) runs when Send code is
  pressed.
- **The code and the new password, together** (`#forgot-password-code`): "Check your email" and "If
  **{email}** has an account, we just sent it a 6-digit code. It works for 30 minutes.", then the code
  field ([components.md](../components.md), 37) and **New password** (help "Between 8 and 128
  characters.", show/hide as in Sign in), the line "Saving it signs you in here and signs out every other
  device." and **Save password and sign in**. They share a screen because the server checks both in one
  call: a call that checked a code on its own would be one more way to try codes. The form carries the
  email in a hidden field with `autocomplete="username"`, and the password is `new-password`, so a
  password manager saves the new one against the right account. Pasting the code, or the phone filling
  it in, moves the focus to the password; typing it does not. Under the button, "You can resend it in
  0:48" as plain muted text while the per-address limit runs, then **Resend code**, and "Not there?
  Check your spam folder. Wrong address? **Change it**", which goes back to the first step with the email
  in place. The countdown comes from the answer to Send code, which says the same for every address.
- **The same answer for every address.** Send code always lands on that step with the same words,
  whether the address has a live account, one deleted in the last 30 days or none, and the server holds a
  floor on the time it takes. **A deleted account gets the code too** (the owner's decision 20), and
  choosing the new password restores it. Nothing on these two steps may tell them apart: not a word, not a delay, not a failed send —
  it is never shown here, because it can only happen to an address that exists —, and not a code error.
  So **every bad code gets the one answer**, `RESET_CODE_INVALID`: mistyped, expired, replaced by a newer
  one, used up by five tries, or asked for an address with no account. Two answers — "wrong" and
  "expired" — would tell which addresses have an account, since only those have a code that can expire.
  The server keeps the tries and the time of each request per address, whether or not an account exists,
  and answers the reset itself in the same time either way.
- **A bad code** (`#forgot-password-wrong-code`): under the code, "That code doesn't work. It may be
  mistyped, out of date or replaced by a newer one: check the last email we sent, or ask for a new code."
  The digits stay and are selected, so typing replaces them; the password stays too; **Save waits until
  the code changes**, because sending the same code again can only fail again.
- **Too many requests** (`#forgot-password-rate-limited`, `RATE_LIMITED`): a `warning` alert with the
  countdown from `Retry-After`, "Too many requests. You can ask for a code again in 4:12.", and Send code
  disabled while it runs. Under an hour the countdown is minutes and seconds; from an hour on it reads "3
  h 10 min", because the daily limits can make it that long. On the code step it is Resend's own.
- **Offline** (`#forgot-password-offline`): a `warning` alert, "You're offline. Sending the code needs a
  connection.", and the button disabled. Every screen in this file that sends something says it the same
  way, with its own verb.
- **From the email's link** (`#choose-new-password`, `/reset#token=…`): "Choose a new password", the
  password (`new-password`), the same line and button, and "Link not working? **Ask for a code
  instead**" (→ `/forgot`). **The token travels in the fragment**, after `#`, which the browser never
  sends to a server, so it reaches no access log, no referrer and no error report. **Opening the page
  spends nothing**: before anything else it takes the token out of the address bar with
  `history.replaceState`, keeps it in memory, and redeems it only with the new password; the token alone
  names the account, so no email is asked for. A reload after that has no token, and says so in its own
  words: "This page lost its link. Open the link from the email again." — not "no longer works", because
  the link may still be good.
- **Busy and failing.** While a request is out, its button shows its spinner and the fields are locked,
  so a second tap sends nothing. A `5xx`, a timeout or no answer shows a `danger` alert, "Something went
  wrong on our side. Nothing changed: try again.", and keeps what was typed and the token in memory. A
  password out of range is the field's error, "Between 8 and 128 characters."; a `RATE_LIMITED` on Save
  is the countdown alert above the button.
- **Done:** the answer is a session, as with Sign in. The app opens on Home with the toast "Password
  changed. Every other device was signed out.", or "Account restored. Every other device was signed out."
  when the reset brought a deleted account back, which the answer says only now that the inbox has been
  proven. What other devices had not sent waits for its owner there, as after any sign-out. The devices
  are not forgotten (the owner's approval E): signing in again on one of them sends no `new-sign-in`.
- **A second factor**, the day two-step verification exists, is one more step between the code and the
  new password. T-214 draws it.

## Cloudflare's check

`#create-account-human-check`, `#human-check-failed`, `#confirm-email-human-check`, `#create-account-unavailable`

Cloudflare Turnstile guards what sends an email or creates an account, and nothing else: **Create
account** and **Resend code** on its code step; **Send code** in Forgot your password? and **Resend code**
on its code step; **Send code** and **Resend code** in Confirm your email to continue; **Send code** and
**Resend code** in the sheet that confirms the email ([states.md](states.md)); and **Save changes** with
a new email and **Resend** on the card of the pending address ([settings.md](settings.md)). **It is
invisible**: it runs when the button is pressed, and the request leaves with its token. **Only when
Cloudflare has doubts does its box appear**, right above that button, with the line "One more step: tick
the box so we know you're a person."; ticking it sends the request that was waiting. The box is
Cloudflare's own widget in its frame, 300 × 65, or its compact size where the column is narrower than
340px; it is given the app's language and the app's mode, not the browser's. The plates only show where
it goes.

- **It failed** (`#human-check-failed`): the widget could not load, said no, or the server refused its
  token. A `danger` alert above the button, "We couldn't check that you're a person. Try again. If it
  keeps failing, something in this browser may be blocking Cloudflare's check, such as a content
  blocker.", and the button tries again with a new token. Nothing was sent.
- Its script comes from `challenges.cloudflare.com` and is loaded on demand, the first time one of those
  screens or sheets opens — inside the app too —, never in the app's bundle; the CSP allows that origin
  in `script-src` and `frame-src`. A token lasts 300 seconds and works once, so it is asked for at the
  moment of sending, never kept and never queued offline.
- The privacy policy names Cloudflare among the processors (T-220).

## Pages reached from an email

Every link in an email lands on a page in this frame that **does nothing until its one button is
tapped**: mail scanners open links, and opening must never confirm, delete or undo anything. The path
says what the tap does, because the page cannot ask the server about a token without spending it
([emails.md](emails.md), "Links, one page per purpose"). The token travels after `#`, and each page takes
it out of the address bar before anything else and keeps it in memory, exactly as `/reset` above. None
needs a session. The frame's language chip changes only the page, never the account.

| Path             | Ready                                                                                                                                                                                                                                                                                                                  | Done                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/verify`        | `#verify-link`: "Confirm your email", "Use the button to confirm that this address is yours." · **Confirm email**                                                                                                                                                                                                      | For a sign-up, `#verify-link-account-ready`: a `mail-check` tile, "Your account is ready", "Sign in with this email and the password you chose." · **Sign in**. For an account from before email existed, `#verify-link-done`: a `mail-check` tile, "Email confirmed", "Nothing else changes in your account." · **Open Ledger Flow** |
| `/confirm-email` | `#confirm-new-email-link`: "Move your account to this address?", "Your account's email becomes the address this message reached, and your other devices are signed out. From now on you sign in with it." · **Confirm new email**                                                                                      | `#confirm-new-email-link-done`: a `mail-check` tile, "Your email changed", "Every other device was signed out. Sign in with this address from now on." · **Open Ledger Flow**                                                                                                                                                         |
| `/undo`          | `#undo-link`: "Undo the change?", "Your account's email goes back to this address, even if the change was already confirmed.", and a `warning` alert, "Every device is signed out and **your current password stops working**. We'll email you a code to choose a new one." · **Undo the change**                      | `#undo-link-done`: an `undo-2` tile, "Change undone", "Every device was signed out. We sent a code to this address so you can choose a new password: it works for 30 minutes." · **Enter the code**                                                                                                                                   |
| `/restore`       | `#restore-link`: "Restore your account?", "Your account was deleted. This brings it back with everything in it, except the shared groups it left.", and a `warning` alert, "Every device is signed out and **your current password stops working**. We'll email you a code to choose a new one." · **Restore account** | `#restore-link-done`: an `archive-restore` tile, "Account restored", "Every device was signed out. We sent a code to this address so you can choose a new password: it works for 30 minutes." · **Enter the code**                                                                                                                    |
| `/reset`         | `#choose-new-password`, above                                                                                                                                                                                                                                                                                          | A session, above                                                                                                                                                                                                                                                                                                                      |

- **Open Ledger Flow** goes to Home when this browser holds the account's session and to Sign in when it
  does not. `/confirm-email` keeps whatever session this browser had — the request carries it and gets
  fresh tokens back — and signs out every other device.
- **`/verify` finishes a sign-up without signing in**: the tap proves the inbox, and a session also
  needs the password, which is why Sign in follows. The answer says which of its two cases it was.
- **`/restore` works like `/undo`**, for an account deleted in the last 30 days (the owner's decision
  20): it is for whoever did not delete it, so it signs everyone out and stops the password, and it does
  so **even if the account was restored meanwhile** — by the person who deleted it, who knows the
  password. **Enter the code** opens the code screen of Forgot your password?, as `/undo` does.
- **`/undo` undoes an email change**, today the only change a notice can undo; when passkeys and two-step
  verification exist, T-214 adds their words. **Enter the code** opens the code screen of Forgot your
  password? for the original address — the undo's answer names it, since whoever tapped holds that inbox
  — and asks for no new code, which would cancel the one just sent.
- **`/confirm-email` when the address was taken meanwhile** (`EMAIL_TAKEN`,
  `#confirm-new-email-link-taken`): a neutral `circle-alert` tile, "That address now belongs to another
  account", "Your account keeps its current email." · **Open Ledger Flow**.
- The Spanish buttons are the emails' words where they share one: «Confirmar correo», «Confirmar nuevo
  correo», «Deshacer el cambio», «Restaurar la cuenta», «Entrar»; and «Abrir Ledger Flow», «Escribir el
  código».

**A link that no longer works** (`#link-no-longer-works`): used, expired, or cancelled by a newer one.
The server answers the three with one code, `LINK_INVALID`, and the page does not tell them apart: a
neutral tile, "This link no longer works", its own line, and a way on.

| Path             | Line                                                                                                                                                                                                                                                                           | Way on                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/verify`        | From a deadline email: "This link worked until its deadline, and only once." From `sign-up` or `verify-email` (`#link-no-longer-works-verify`): "A link to create an account or to confirm an email works for 24 hours and only once, and asking for another code cancels it." | **Open Ledger Flow** for a deadline email, where the stripe or Confirm your email to continue offer a new code; otherwise **Create account**, with **Open Ledger Flow** as a quiet second button |
| `/confirm-email` | The same.                                                                                                                                                                                                                                                                      | **Open Ledger Flow**, where Password & email offers Resend                                                                                                                                       |
| `/undo`          | "An undo link works for 7 days and only once. If something still looks wrong, Forgot your password? signs everyone out."                                                                                                                                                       | **Forgot your password?**                                                                                                                                                                        |
| `/restore`       | "A restore link works for 7 days and only once. Until the account is erased, Forgot your password? restores it too."                                                                                                                                                           | **Forgot your password?**                                                                                                                                                                        |
| `/reset`         | "A password link works for 30 minutes and only once, and asking for another code cancels it."                                                                                                                                                                                  | **Ask for a new code**                                                                                                                                                                           |

**Which email a dead `/verify` link came from.** A deadline email's token has a shape of its own, so the
page knows it; the links of `sign-up` and `verify-email` look the same, and a dead one tells the page
nothing more — the server answers `LINK_INVALID` for both. So one line covers the two, and both ways on
are offered: Create account first, since a sign-up is what most of these links are.

**`/restore` when the code could not go** (`#restore-link-done-no-code`, `codeSent: false`): the account is
back and its password stopped all the same, so the page does not claim a code: "Account restored",
"Every device was signed out, and your old password no longer works. We couldn't send the code to choose
a new one: ask for it from Forgot your password?." · **Forgot your password?**, with the address carried
over. `/undo` gets its words in T-219.

**An account that is already confirmed** is not a dead link on `/verify`: whoever confirmed with the code
and then taps the link sees "Your account is ready" or "Email confirmed".

**Busy, failing, offline and too many requests** read as in Forgot your password?: the button's spinner
while the request is out, so a double tap can never spend the token and then report it dead; the `danger`
alert for a `5xx` with the token kept; the `warning` alert "You're offline. This needs a connection." with
the button disabled; or the countdown with the button disabled until it ends.
