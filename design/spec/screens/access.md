# Access

`preview/access.html`

- **The frame:** a centred card, 440px at most, the brand on top, an h1 plus one line of context, the
  form, a 48px call to action, and the link that swaps sign-in for sign-up. No tab bar and no sidebar. A
  **language chip** (`globe` plus "EN" / "ES") sits to the right of the brand in sign-in, sign-up and
  onboarding: it changes the screen's language instantly, before an account exists.
- **Sign in** (`#sign-in`): email, password with show/hide (`eye`), and "Forgot your password?" visible
  but inactive and marked "soon" until email sending exists. A 401 shows a `danger` alert, "Wrong email
  or password" — one message, never revealing which half failed. A 429 (`#sign-in-rate-limited`) shows a
  `warning` alert with a countdown computed from `Retry-After` or from the 15-minute window, and the
  button stays disabled while it runs.
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
  (`#account-reactivated`) shows an `info` alert, "Welcome back…", on the first screen after signing up
  and skips onboarding, because accounts already exist. A 409 `EMAIL_TAKEN`/`DUPLICATE` shows an inline
  error under the email with a "Sign in" link. A 500 shows "Your account may already have been created:
  try signing in before signing up again."

- **Onboarding 1 · first account** (`#onboarding-first-account`): step dots on top; name, type (**the
  same `picker` row as the account form**, not chips), an optional current balance (sent as `balance`,
  kept as `openingBalance`) and a colour. The copy says it will be the main account.
- **Onboarding 2 · a ceiling for the month** (`#onboarding-monthly-ceiling`): the amount with three
  suggestions, an explanation of the global budget, and "Create budget" (`POST /budgets` with
  `categoryIds: []` and `periodType: MONTHLY`) or "Not now". Both steps can be picked up again from Home
  if they are skipped.
