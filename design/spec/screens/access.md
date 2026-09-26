# Access

`preview/access.html`

- **The frame:** a centred card, 440px at most, the brand on top, an h1 plus one line of context, the
  form, a 48px call to action, and the link that swaps sign-in for sign-up. No tab bar and no sidebar. A
  **language chip** (`globe` plus "EN" / "ES") sits to the right of the brand in sign-in, sign-up and
  onboarding: it changes the screen's language instantly, before an account exists.
- **Sign in** (`#sign-in`): email, password with show/hide (`eye`), and "Forgot your password?", which
  opens [its flow](#forgot-your-password-forgot) with the email carried over when one was typed. A 401
  shows a `danger` alert, "Wrong email or password" — one message, never revealing which half failed. A
  429 (`#sign-in-rate-limited`) shows a `warning` alert with a countdown computed from `Retry-After` or
  from the 15-minute window, and the button stays disabled while it runs.

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

  Signing up returns tokens, so it goes straight into onboarding. `reactivated: true`
  (`#account-reactivated`) skips onboarding, because accounts already exist, and lands on Home with an
  `info` alert, "Welcome back…". The server reactivates a deleted account only with the password it
  had (T-153); with any other one it answers like a live account. A 409 `EMAIL_TAKEN`
  (`#create-account-email-taken`) shows an inline error under the email, "This email already has an
  account. **Sign in** or **reset your password**. If you deleted it, sign up with the password it had to
  bring it back.", both bold parts being links that carry the email over. Resetting is how the owner of
  an inbox takes back an address somebody else registered and never confirmed: the code reaches the
  inbox, not the one who typed it. A 500 shows "Your account may
  already have been created: try signing in before signing up again."

- **Onboarding 1 · first account** (`#onboarding-first-account`): step dots on top; name, type (**the
  same `picker` row as the account form**, not chips), an optional current balance (sent as `balance`,
  kept as `openingBalance`) and a colour, drawn at random like every create form
  ([color.md](../color.md)). The copy says it will be the main account.
- **Onboarding 2 · a ceiling for the month** (`#onboarding-monthly-ceiling`): the amount with three
  suggestions, an explanation of the global budget, and "Create budget" (`POST /budgets` with
  `categoryIds: []`, `periodType: MONTHLY` and a colour drawn at random, since this step shows no
  swatches) or "Not now". Both steps can be picked up again from Home
  if they are skipped.

## Forgot your password? (`/forgot`)

- **Asking** (`#forgot-password`): the frame of Sign in; "Forgot your password?", "Type your account's
  email and we'll send a code to it so you can choose a new password.", the email — carried over from
  Sign in or from the 409 when one was typed there, empty when arriving from an email's `/forgot` link
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
  whether the address has a live account, a deleted one or none, and the server holds a floor on the time
  it takes. Nothing on these two steps may tell them apart: not a word, not a delay, not a failed send —
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
  changed. Every other device was signed out." — unless the account had never confirmed its email
  ([below](#keep-whats-in-this-account)). What other devices had not sent waits for its owner there, as
  after any sign-out.
- **A second factor**, the day two-step verification exists, is one more step between the code and the
  new password. T-214 draws it.

## Cloudflare's check

`#create-account-human-check`, `#human-check-failed`, `#confirm-email-human-check`

Cloudflare Turnstile guards what sends an email or creates an account, and nothing else: **Create
account**; **Send code** in Forgot your password? and **Resend code** on its code step; **Send code** and
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

## Keep what's in this account?

`#keep-or-start-fresh`, `#start-fresh`, `#start-fresh-details`

Only after a reset of an account that **had never confirmed its email and has something in it** (the
owner's decision 12 of 2026-09-26): whoever created it may not have been the owner of the inbox. An
account with no accounts and no transactions skips it, because there is nothing to keep. It is a step of
the frame between the reset and the app, not a sheet over the app, and **the app opens nothing of the
account before the answer**: no copy is downloaded to the device until it is known which account stays.

- "Keep what's in this account?" and "Your email is confirmed now. Until today it never was, so someone
  else could have created this account with your address." A card with three facts that help tell:
  **Created**, **Accounts** and **Transactions**, a date and two counts — never a name, because what
  somebody else typed is not shown as if it were ours. Then "Keep it if you created it and never got
  around to confirming the email. Start fresh if you didn't: nothing somebody else put in it stays with
  you."
- **Keep it** is the primary, because the usual case is an owner who forgot both the password and the
  confirmation; it opens the app. **Start fresh** asks first (`#start-fresh`): a `danger` alert,
  "Everything in this account is **deleted for good**: its accounts, transactions, budgets and
  categories, and it leaves every shared group. Your email and the password you just chose stay.", with
  **Delete everything and start** (solid `danger`) and **Go back**. It leaves each shared group the way
  Leave does ([shared.md](shared.md)): the others keep the person and the money as it stood.
- **Then "Your details"** (`#start-fresh-details`): name, language, currency and time zone, as in Create
  account and detected the same way, with "A fresh start takes nothing from before, not even the name.
  You can change these later in Settings." — whoever created the account typed the old ones — and
  **Continue**, into onboarding as a new account. The currency is free again, since no account exists.
- **Asked once, and answered for sure:** the server keeps the question open until it has an answer, so
  closing the page and opening the app again lands here. The three facts come with the question.

## Pages reached from an email

Every link in an email lands on a page in this frame that **does nothing until its one button is
tapped**: mail scanners open links, and opening must never confirm, delete or undo anything. The path
says what the tap does, because the page cannot ask the server about a token without spending it
([emails.md](emails.md), "Links, one page per purpose"). The token travels after `#`, and each page takes
it out of the address bar before anything else and keeps it in memory, exactly as `/reset` above. None
needs a session. The frame's language chip changes only the page, never the account.

| Path             | Ready                                                                                                                                                                                                                                                                                                                                                                                                                                            | Done                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/verify`        | `#verify-link`: "Confirm your email", "Use the button to confirm that the address this email reached belongs to your Ledger Flow account." · **Confirm email**                                                                                                                                                                                                                                                                                   | `#verify-link-done`: a `mail-check` tile, "Email confirmed", "You can invite people to Shared and accept their invitations." · **Open Ledger Flow**                                                 |
| `/confirm-email` | `#confirm-new-email-link`: "Move your account to this address?", "Your account's email becomes the address this message reached, and your other devices are signed out. From now on you sign in with it." · **Confirm new email**                                                                                                                                                                                                                | "Your email changed", "Every other device was signed out. Sign in with this address from now on." · **Open Ledger Flow**                                                                            |
| `/not-me`        | `#not-me-link`: "Delete the account that used your address?", "Somebody signed up to Ledger Flow with this address and never confirmed it. This deletes that account and everything in it, for good, and frees your address.", and a `warning` alert, "**If you signed up yourself, don't.** Use the code or the Confirm email button in the same message instead." · **Delete that account** (solid `danger`) · **Don't delete it** (→ Sign in) | `#not-me-link-done`: a `user-x` tile, "That account is gone", "Your address is free: you can create your own account with it." · **Create account**                                                 |
| `/undo`          | `#undo-link`: "Undo the change?", "Your account's email goes back to this address, even if the change was already confirmed.", and a `warning` alert, "Every device is signed out and **your current password stops working**. We'll email you a code to choose a new one." · **Undo the change**                                                                                                                                                | `#undo-link-done`: an `undo-2` tile, "Change undone", "Every device was signed out. We sent a code to this address so you can choose a new password: it works for 30 minutes." · **Enter the code** |
| `/reset`         | `#choose-new-password`, above                                                                                                                                                                                                                                                                                                                                                                                                                    | A session, above                                                                                                                                                                                    |

- **Open Ledger Flow** goes to Home when this browser holds the account's session and to Sign in when it
  does not. `/confirm-email` keeps whatever session this browser had — the request carries it and gets
  fresh tokens back — and signs out every other device.
- **`/not-me` erases**: the account and everything in it are removed, not archived as Delete account
  does, so no sign-up with the old password can bring it back, and no `account-deleted` is sent. Its
  token belongs to that account **and** that address: it stops working when the account's address
  changes or is confirmed.
- **`/undo` undoes an email change**, today the only change a notice can undo; when passkeys and two-step
  verification exist, T-214 adds their words. **Enter the code** opens the code screen of Forgot your
  password? for the original address — the undo's answer names it, since whoever tapped holds that inbox
  — and asks for no new code, which would cancel the one just sent.
- **`/confirm-email` when the address was taken meanwhile** (`EMAIL_TAKEN`): "That address now belongs to
  another account", "Your account keeps its current email." · **Open Ledger Flow**.
- The Spanish buttons are the emails' words where they share one: «Confirmar correo», «Confirmar correo
  nuevo», «Deshacer el cambio»; and «Eliminar esa cuenta», «No la elimines», «Abrir Ledger Flow»,
  «Escribir el código».

**A link that no longer works** (`#link-no-longer-works`): used, expired, or cancelled by a newer one.
The server answers the three with one code, `LINK_INVALID`, and the page does not tell them apart: a
neutral tile, "This link no longer works", its own line, and a way on.

| Path             | Line                                                                                                                     | Way on                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `/verify`        | "A confirmation link works for 24 hours and only once, and asking for another code cancels it."                          | **Open Ledger Flow**, where the stripe offers a new code   |
| `/confirm-email` | The same.                                                                                                                | **Open Ledger Flow**, where Password & email offers Resend |
| `/not-me`        | "It only works while the account is unconfirmed. If you didn't confirm it, Forgot your password? takes it back for you." | **Forgot your password?**                                  |
| `/undo`          | "An undo link works for 7 days and only once. If something still looks wrong, Forgot your password? signs everyone out." | **Forgot your password?**                                  |
| `/reset`         | "A password link works for 30 minutes and only once, and asking for another code cancels it."                            | **Ask for a new code**                                     |

**An account that is already confirmed** is not a dead link on `/verify`: whoever confirmed with the code
and then taps the link sees "Email confirmed". On `/not-me` it is the line of the table, because the
account is somebody's now.

**Busy, failing, offline and too many requests** read as in Forgot your password?: the button's spinner
while the request is out, so a double tap can never spend the token and then report it dead; the `danger`
alert for a `5xx` with the token kept; the `warning` alert "You're offline. This needs a connection." with
the button disabled; or the countdown with the button disabled until it ends.
