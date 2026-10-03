# Emails

`preview/emails.html`

Every email the app sends. They are built and sent by the backend, which does not import anything from
this repository: its templates copy the layout, the values and the words from here and from the plates.
When one of them changes here, the backend's template changes with it.

## The envelope

- **From:** `Ledger Flow <no-reply@ledgerflow.alexpiral.com>`. **Reply-To:** `ledgerflow@alexpiral.com`,
  the same contact as Settings › Your data and the legal pages.
- **Language:** the account's `locale` (`en` or `es`), never the request's. The HTML carries it in
  `<html lang>`, and every link in it goes to that locale.
- **Subject:** says what happened, with "Ledger Flow" in it, because some lists show the subject before
  the sender. **Preview text** (a hidden line at the top of the body that a list shows after the
  subject): one sentence that tells you whether you need to act.
- **The code never goes in the subject or the preview text**: both show up on a locked phone. It is
  only in the body.

## The layout

One layout for every email, top to bottom:

| Piece          | What it is                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas         | `bg`, the whole width. 24px above, 32px below, 12px at the sides                                                                                                  |
| Card           | `surface`, 1px `border`, radius 14px, at most 560px wide and centred, 28px × 24px of padding, 16px between pieces                                                 |
| Brand          | "Ledger Flow" as text, 16px semibold, `brand-text`. No logo: there are no images                                                                                  |
| Title          | 22px semibold, line height 1.3                                                                                                                                    |
| Lead           | 15px, line height 1.5. One or two sentences, and at most one more line in 13px `text-2`                                                                           |
| Code           | Only in the code emails. `surface-2`, radius 10px, 16px of padding, centred, monospace 32px semibold, letter spacing 0.3em                                        |
| Code note      | 13px `text-2`: how long it works and that only Ledger Flow asks for it                                                                                            |
| Facts          | Only in the security notices. A two-row table, When and Device: label 13px `text-2` in an 88px column, value 15px; 8px rows with a 1px `border` line between them |
| Button         | Full width, radius 10px, 14px × 24px, 15px semibold. Primary: `brand` with `on-brand`. Secondary: `surface`, 1px `border-strong`, `text`                          |
| Fallback link  | Under every button, 13px `text-2`: "If the button doesn't work, open this link:" and the whole URL, which wraps anywhere                                          |
| "Not you?" box | `surface-2`, radius 10px, 16px of padding: a 15px semibold heading, one or two sentences, and a secondary button if there is something to do                      |
| Footer         | Outside the card, 12px `text-3`, 16px below it: why you are getting this, and "Ledger Flow · ledgerflow.alexpiral.com · Questions? ledgerflow@alexpiral.com"      |

**One primary button at most.** The primary button is what you came for (confirm, choose a new
password). Whatever you would only do if it was not you lives in the grey box, as a secondary button.
The security notices have no primary button: if it was you there is nothing to do.

**Fonts are the client's own**: `-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`, and
`ui-monospace, "SF Mono", Menlo, Consolas, monospace` for the code. Geist would be a remote file, and
most clients do not load it.

## Building it for mail clients

The plates are drawn with the preview's CSS; the template is not. Outlook for Windows renders with Word
and Gmail drops much of what a page can do, so the backend builds the same picture this way:

- **Tables for layout**, every one `role="presentation"`, `cellpadding="0"`, `cellspacing="0"`,
  `border="0"`. The card is a table 100% wide with `max-width: 560px`, and for Outlook it sits inside an
  `<!--[if mso]>` table of `width="560"`. Space between pieces is cell padding, never margin, flex or
  `gap`.
- **Inline styles** on every element. A `<style>` block in the head carries only what cannot be inline:
  the dark-mode media query and the narrow-screen rule.
- **The button is a table cell** with the background colour (`bgcolor` and `background-color`) and the
  padding, and a link inside it that fills it. Outlook for Windows squares the corners; that is accepted.
- **The fallback URL** wraps with `word-break: break-all`.
- **The preview text** is the first thing in the body: a `div` with `display: none; max-height: 0;
overflow: hidden; mso-hide: all`, followed by a run of `&#847;&zwnj;&nbsp;` so the client does not
  fill the rest of the preview with the start of the body.
- **The separator between the two facts** is a `border-top` on the second row's cells.

## Colours

Tinta, the default palette, whatever palette the person uses in the app. An email cannot read the app's
tokens (no custom properties, no OKLCH), so the values are written out, here and in `ui.css` for the
plates, which is why the plates do not follow the preview's palette picker. `npm run contrast-check`
fails if either copy stops matching the tokens, and the backend's template follows the day they change.

| Role           | Token             | Light     | Dark      |
| -------------- | ----------------- | --------- | --------- |
| Canvas         | `--bg`            | `#fcf6ee` | `#0b0804` |
| Card           | `--surface`       | `#fffefb` | `#15110c` |
| Code, box      | `--surface-2`     | `#f5efe7` | `#1d1913` |
| Separators     | `--border`        | `#e4dfd7` | `#2a2620` |
| Secondary edge | `--border-strong` | `#c2bdb5` | `#413c36` |
| Text           | `--text`          | `#1c1812` | `#f1eeea` |
| Metadata       | `--text-2`        | `#59544e` | `#afaaa3` |
| Footer         | `--text-3`        | `#646059` | `#8a857e` |
| Primary button | `--brand`         | `#4747ae` | `#8991ff` |
| On the button  | `--on-brand`      | `#ffffff` | `#090a21` |
| Brand, links   | `--brand-text`    | `#39359b` | `#b9c4ff` |

**Dark mode** is the right-hand column, applied with `@media (prefers-color-scheme: dark)` and
announced with `<meta name="color-scheme" content="light dark">` and
`<meta name="supported-color-schemes" content="light dark">`. Apple Mail and iOS Mail honour it. The
rest either show the light version (Gmail on the web) or invert the light one themselves (the Gmail
apps, Outlook.com and the Outlook apps, Windows included). The design survives inversion because there
is nothing to break: no images, no transparent pieces, every colour a flat fill with its text on top.
T-205 checks it in Gmail, Outlook and Apple Mail, light and dark, before calling the template done.

## What an email never has

- **Images of any kind**, remote or attached, and so no tracking pixel. SES open and click tracking stay
  **off** in the configuration set: click tracking rewrites every link through an AWS domain, which
  breaks the rule below and would put someone else's domain in a password reset.
- **Links anywhere but `https://ledgerflow.alexpiral.com/{locale}/…`**, and the contact's `mailto:`.
- **Anything a person typed**: not the account's name, not a passkey's name, not a group's. A name can
  be set by whoever registered someone else's address, and it would reach that inbox as our words.
  - There are two exceptions, both addresses the owner needs to see. Each goes in only after the API's
    strict email validation, HTML-escaped, as plain text and never a link, and never in a subject or the
    preview text:
    - the new address in `email-change-requested`;
    - the account's current address in `email-change-confirm`, **masked**, as the account stores it (already
      trimmed and lowercase), never from the request. The local part keeps its first two characters, or
      only the first if it has three or fewer, followed by exactly three `•` (U+2022) whatever its length,
      in the HTML and the plain text alike; the domain stays whole. `ana.ruiz@work.example` is
      `an•••@work.example`, `ana+ledger@example.com` is `an•••@example.com` and `ana@example.com` is
      `a•••@example.com`. The API only accepts ASCII addresses, so a character is a byte. It is masked
      because the new address is not confirmed yet: after a typo the email reaches a stranger, who must
      not learn somebody's full address (on a personal domain the domain alone can still say who it is).
  - **The device is not typed text**: it is read from the user agent, which the sender controls, so it
    only ever takes values from a fixed list of browser and system names. Anything else is "Unknown
    device". It is the only variable that reaches a subject.
- **An action that happens by opening a link.** Mail scanners open links. Every link lands on a page
  that asks for one tap ([access.md](access.md), "Pages reached from an email").
- **A way to turn the security notices off** (the owner's decision 8, 2026-09-26).

## Plain-text version

Every email goes with one (`multipart/alternative`). The same words in the same order: "Ledger Flow"
on the first line, the title, the lead; the code on its own indented line, or the facts as "When: …"
and "Device: …"; every button written as "Label: URL"; and the footer after a line with `--`, with the
site's address in full.

## Dates and devices

- **When:** the moment it happened, in the account's time zone and language:
  `Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "numeric",
minute: "2-digit", timeZone, timeZoneName: "shortOffset" })` with `en-US` or `es-CO`. It reads "Sep 26,
  2026, 7:42 PM GMT-5" and "26 de sept de 2026, 7:42 p. m. GMT-5".
- **A date** (the day an account was deleted, the day it is erased, a deadline): the day alone, in the
  account's time zone and language, `Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day:
"numeric", timeZone })`: "October 28, 2026" and "28 de octubre de 2026". **The year is left out
  when it is the year the email is sent**, as in the plates ("October 28"), and written when it is not
  ("January 3, 2027"). A day is whole: "by October 12" and "kept until October 28" mean to the end of
  that day in the account's time zone, and the erasure happens in the first nightly pass after it.
- **Device:** "Browser on OS" ("Chrome on Windows", "Chrome en Windows"), the same reading as Active
  sessions, from the fixed list above. No IP address and no place: we do not locate people.

## The emails

| Template                    | When                                                                                    | To                   | Link                              | Works for          | Budget                    |
| --------------------------- | --------------------------------------------------------------------------------------- | -------------------- | --------------------------------- | ------------------ | ------------------------- |
| `sign-up`                   | Create account, and Resend on its code step, when the address has no account            | The address typed    | `/{locale}/verify#token=…`        | 24 hours           | Verification and security |
| `account-exists`            | The same moment, when the address already has an account, live or deleted               | The account          | `/{locale}/login`, `/forgot`      | —                  | Verification and security |
| `verify-email`              | Send code and Resend, for an account from before email existed                          | The account          | `/{locale}/verify#token=…`        | 24 hours           | Verification and security |
| `confirm-deadline`          | Once, when confirming became required, to every account from before that is unconfirmed | The account          | `/{locale}/verify#token=…`        | Until its deadline | Verification and security |
| `confirm-deadline-reminder` | Four days before that deadline, if it is still unconfirmed                              | The account          | `/{locale}/verify#token=…`        | Until its deadline | Verification and security |
| `password-reset`            | Forgot your password?, only when the address has an account, live or deleted            | The account          | `/{locale}/reset#token=…`         | 30 minutes         | Reset                     |
| `password-reset-after-undo` | "Undo the change" or "Restore account" was confirmed                                    | The original address | `/{locale}/reset#token=…`         | 30 minutes         | Reset                     |
| `password-changed`          | Password & email, and after a reset of a live account                                   | The account          | `/{locale}/forgot`                | —                  | Verification and security |
| `email-change-confirm`      | Password & email, a new address                                                         | The new address      | `/{locale}/confirm-email#token=…` | 24 hours           | Verification and security |
| `email-change-taken`        | Password & email, when the new address already has an account                           | The new address      | `/{locale}/login`                 | —                  | Verification and security |
| `email-change-requested`    | The same moment                                                                         | The old address      | `/{locale}/undo#token=…`          | 7 days             | Verification and security |
| `new-sign-in`               | A sign-in from a device with no valid device token for that email                       | The account          | `/{locale}/forgot`                | —                  | Verification and security |
| `account-deleted`           | Delete my account                                                                       | The account          | `/{locale}/restore#token=…`       | 7 days             | Verification and security |
| `account-restored`          | A deleted account came back by signing in, or by a reset                                | The account          | `/{locale}/forgot`                | —                  | Verification and security |
| `passkey-added`             | A passkey is added · for later                                                          | The account          | `/{locale}/undo#token=…`          | 7 days             | Verification and security |
| `two-factor-on`             | The authenticator app is turned on · for later                                          | The account          | `/{locale}/undo#token=…`          | 7 days             | Verification and security |
| `passkey-removed`           | A passkey is removed · for later                                                        | The account          | `/{locale}/forgot`                | —                  | Verification and security |
| `two-factor-off`            | The authenticator app is turned off · for later                                         | The account          | `/{locale}/forgot`                | —                  | Verification and security |
| `recovery-code-used`        | A recovery code signs in or resets the password · for later                             | The account          | `/{locale}/forgot`                | —                  | Verification and security |

**Links, one page per purpose.** The page cannot ask the server what a token does without redeeming it,
so the path says it, and each page can say what its tap does before the tap:

| Path             | What its one tap does                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/verify`        | Confirms the address: it finishes creating the account of a `sign-up`, or confirms an account from before email existed                                                                                |
| `/confirm-email` | Moves the account to the new address. Every other device is signed out; if this browser has the account's session it keeps it, if not it stays signed out, which is why the email says "other devices" |
| `/undo`          | Undoes the change the email was about and sends `password-reset-after-undo`                                                                                                                            |
| `/restore`       | Restores the deleted account, as `/undo` does: every device is signed out, the password stops working, and `password-reset-after-undo` goes out                                                        |
| `/reset`         | Opens "choose a new password" with the token, and redeems it only when the new password is sent                                                                                                        |
| `/forgot`        | Forgot your password? with nothing filled in. No token                                                                                                                                                 |
| `/login`         | Sign in. No token                                                                                                                                                                                      |

The path names are a contract: the pages at them are drawn in [access.md](access.md).

**Tokens and codes.**

- **Every link carries its own token, for one purpose and one use**; the plates show the same token
  in every link only because they are mockups. A token is kept as a hash, like the code. **It travels
  in the fragment, after `#`**, which the browser never sends to a server: it reaches no access log, no
  referrer and no error report, and the page takes it from there ([access.md](access.md)).
- **Every code takes 5 wrong tries** and then stops working, whatever it is for; asking for another one
  cancels the one before, and the email says so — but only once the new email has been accepted for
  delivery, so a send that fails never leaves the person with no working code.
- **"Undo the change" and "Restore account" stop the current password**: whoever made the change or
  deleted the account knows it. From the tap, the account can only be entered after choosing a new one
  with `password-reset-after-undo`, or with Forgot your password? if that code expires.
- **The deadline links work until their deadline**, not 24 hours: `confirm-deadline` and its reminder
  carry no code, so their one link has to last as long as the request does. Like every link it works
  once, and it stops when the account is confirmed or moves to another address.

**Who gets what.**

- **Budget** is the slice of the daily cap each email spends: the reset has its own, so filling the rest
  never blocks one.
- **An account exists only once its address is confirmed** (the owner's decision 16 of 2026-09-28).
  Create account sends `sign-up` with the code that creates it; nothing else is sent before that code is
  typed or its link tapped, and nothing else is needed: that email is also the welcome.
- **Create account answers the same for every address**, so it never tells who has an account. When the
  address has one, live or deleted, the inbox gets `account-exists` instead of `sign-up`, at the same
  moment and under the same limits, and the screen reads exactly the same ([access.md](access.md)). A
  deleted account in its 30 days has its own words in that email, with the date it is erased, and an
  address kept by an undo link (below) has its own too. **It also takes the same time**: both branches do
  the same work — the password is hashed and a pending sign-up is written in both — and the server holds
  a floor on the answer, as Forgot your password? does; neither waits on the email going out, and a send
  that fails is never shown there, since only the no-account branch could fail differently.
- **An address that changes account also answers the same for every address** (Password & email,
  [settings.md](settings.md)): the app shows the change waiting either way, and an address that already
  has an account, live, deleted or kept by an undo link, gets `email-change-taken` instead of
  `email-change-confirm`. The requester's own old address still gets `email-change-requested`, and the
  change simply never confirms; the race that `/confirm-email` answers with `EMAIL_TAKEN` stays, because
  only the inbox that holds the link sees it.
- **Whoever controls the inbox wins.** An account from before email existed whose address was mistyped
  years ago belongs, from the inbox's side, to whoever holds that inbox: Forgot your password? reaches
  them, the reset confirms the address, and they are in. It was true before T-237 too; Start fresh used to
  let them drop what they found, and with it gone they simply own the account. An account that never
  confirms keeps its address and its data: the deadline only closes the door.
- **The accounts from before email existed** have 14 days to confirm (the owner's decision 17).
  `confirm-deadline` goes to each unconfirmed one the night the rule is published, and its deadline is
  14 days from that email; `confirm-deadline-reminder` goes four days before it, only if the account is
  still unconfirmed. With `account-exists`, they are the only emails that can reach an address nobody
  confirmed without the person asking — which is why each carries the box "Don't have a Ledger Flow account?": the address may have been
  mistyped years ago. `verify-email` is what the app's Send code and Resend send to those accounts.
- **`new-sign-in`** goes to a device without a valid device token for the account. Signing up sends
  `sign-up` and never `new-sign-in`, because confirming the code gives the device its token. A reset, a
  confirmed undo or restore, and `/confirm-email` send none either: they already send their own email.
  **Only an undo, a restore from its link and Sign out all other sessions forget the devices** (the owner's
  approval E of 2026-09-28): after one of those, each device can get one `new-sign-in` on its next sign-in.
  A password change and a reset do not, because the app signs in again right after them and would warn
  its own owner.
- **Security notices go to every account**, because every address is confirmed now; the few accounts
  from before email existed get them once they confirm.
- **`email-change-requested` goes only to an address that was confirmed.** An account from before email
  existed that never confirmed is usually correcting a typo, and the old address may be a stranger's:
  telling them the new one would hand over somebody's real address. The old codes and links simply stop
  working.
- **`email-change-confirm` names the account that moves**, masked (above). Several accounts can ask for
  the same new address at once, each with its own code and link; without the name, the owner could tap
  the link of someone else's request and move that account to their address, with the invitations
  waiting for it. The mask lets the owner pick their own email when two arrive; an account with a
  lookalike address (someone who knows the owner's domain and first letters) could still fool it. The
  code cannot be mixed up: it only works in the app, signed in to the account that asked.
- **While an undo link works, the old address stays reserved** for the account, so nobody can sign up
  with it in those 7 days and the undo never collides with another account. Create account with a
  reserved address sends `account-exists` in its held words, with the day the address is free.
- **A deleted account is kept 30 days and then erased for good** (the owner's decisions 19 and 20):
  everything in it, and the address becomes free. `account-deleted` gives that date. In those 30 days it
  comes back three ways, and **every one of them tells the inbox**: signing in with its password sends
  `account-restored`; a reset sends `account-restored` instead of `password-changed`; and "Restore
  account" in `account-deleted`, for whoever did not delete it, sends `password-reset-after-undo` in its
  restore words, because it stops the password. **No link in any email deletes anything.**
- **Nothing is sent when the account is finally erased**: `account-deleted` already gave the date, and
  after it there is no account for the email to be about.
- `passkey-added`, `two-factor-on`, `passkey-removed`, `two-factor-off` and `recovery-code-used` are
  drawn now so the notices are complete, and are sent once passkeys and two-step verification exist.
  **Their words are provisional**: T-214 designs that sign-in, and changes them here if it has to.

## The words

The subject, the preview text, the title, the lead and the box of every email, in both languages. The
plates show them in place, and `build.mjs` holds the same text. **How long a code or a link works is said
once per email** (the owner's approval F of 2026-09-28): in the code note, or in the box that holds the
link, never again in the preview text or the lead. `{date}` is a date as "Dates and devices" says.

**Shared by all of them**

| Piece                | en                                                                                                                                                                        | es                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fallback link        | If the button doesn't work, open this link:                                                                                                                               | Si el botón no funciona, abre este enlace:                                                                                                                                                                                      |
| Code note            | Only type this code in Ledger Flow. Nobody from Ledger Flow will ever ask you for it.                                                                                     | Escribe este código solo en Ledger Flow. Nadie de Ledger Flow te lo va a pedir.                                                                                                                                                 |
| Code, 24 hours       | It works for 24 hours. Asking for another one cancels this one.                                                                                                           | Vale por 24 horas. Si pides otro, este deja de valer.                                                                                                                                                                           |
| Code, 30 minutes     | It works for 30 minutes. Asking for another one cancels this one.                                                                                                         | Vale por 30 minutos. Si pides otro, este deja de valer.                                                                                                                                                                         |
| Facts                | When · Device                                                                                                                                                             | Cuándo · Dispositivo                                                                                                                                                                                                            |
| Footer, a code email | You're getting this because {reason}.                                                                                                                                     | Recibes este correo porque {reason}.                                                                                                                                                                                            |
| Footer, a notice     | This is a security notice for your Ledger Flow account. These can't be turned off: they're how we tell you what happens to your account.                                  | Es un aviso de seguridad de tu cuenta de Ledger Flow. Estos avisos no se pueden desactivar: así te contamos lo que pasa con tu cuenta.                                                                                          |
| Footer, second line  | Ledger Flow · ledgerflow.alexpiral.com · Questions? ledgerflow@alexpiral.com                                                                                              | Ledger Flow · ledgerflow.alexpiral.com · ¿Dudas? ledgerflow@alexpiral.com                                                                                                                                                       |
| Box heading          | Not you?                                                                                                                                                                  | ¿No fuiste tú?                                                                                                                                                                                                                  |
| Buttons              | Reset password · Undo the change · Restore account · Sign in                                                                                                              | Restablecer contraseña · Deshacer el cambio · Restaurar la cuenta · Entrar                                                                                                                                                      |
| Box, reset           | Reset your password now. It signs out every device.                                                                                                                       | Restablece tu contraseña ya. Se cierra la sesión en todos los dispositivos.                                                                                                                                                     |
| Box, undo a factor   | Undo it: we remove every passkey, authenticator app and recovery code added since then, sign out every device, and you choose a new password. This link works for 7 days. | Deshazlo: quitamos las llaves de acceso, la app de autenticación y los códigos de recuperación añadidos desde entonces, se cierra la sesión en todos los dispositivos y eliges una contraseña nueva. El enlace vale por 7 días. |

**`sign-up`** — the welcome and the code that creates the account

| Piece   | en                                                                                  | es                                                                                         |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Subject | Finish creating your Ledger Flow account                                            | Termina de crear tu cuenta de Ledger Flow                                                  |
| Preview | Type the code in the app or use the button.                                         | Escribe el código en la app o usa el botón.                                                |
| Title   | Welcome to Ledger Flow                                                              | Te damos la bienvenida a Ledger Flow                                                       |
| Lead    | Type this code in the app to confirm this address and finish creating your account. | Escribe este código en la app para confirmar esta dirección y terminar de crear tu cuenta. |
| Line    | Didn't sign up? Ignore this email: without the code, no account is created.         | ¿No te registraste? Ignora este correo: sin el código no se crea ninguna cuenta.           |
| Button  | Confirm email                                                                       | Confirmar correo                                                                           |
| Reason  | someone started creating a Ledger Flow account with this address                    | alguien empezó a crear una cuenta de Ledger Flow con esta dirección                        |

No box: with no account yet there is nothing to undo, and the line says what ignoring does.

**`account-exists`** — instead of `sign-up`, when the address has an account

| Piece   | en                                                                                                                       | es                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | You already have a Ledger Flow account                                                                                   | Ya tienes una cuenta de Ledger Flow                                                                                                                 |
| Preview | Sign in with it, or choose a new password if you forgot it.                                                              | Entra con ella, o elige una contraseña nueva si la olvidaste.                                                                                       |
| Title   | You already have an account                                                                                              | Ya tienes una cuenta                                                                                                                                |
| Lead    | Someone tried to create a Ledger Flow account with this address, and it already has one. If it was you, sign in with it. | Alguien intentó crear una cuenta de Ledger Flow con esta dirección, y ya tiene una. Si fuiste tú, entra con ella.                                   |
| Line    | If it wasn't you, ignore this email: nothing changed.                                                                    | Si no fuiste tú, ignora este correo: no cambió nada.                                                                                                |
| Button  | Sign in (→ `/login`)                                                                                                     | Entrar                                                                                                                                              |
| Box     | **Forgot your password?** Choose a new one with a code sent here. It signs out every device. · Reset password            | **¿Olvidaste tu contraseña?** Elige una nueva con un código que llega aquí. Se cierra la sesión en todos los dispositivos. · Restablecer contraseña |
| Reason  | someone tried to sign up for Ledger Flow with this address                                                               | alguien intentó registrarse en Ledger Flow con esta dirección                                                                                       |

**When the account is deleted** and still in its 30 days, the same email with these pieces:

| Piece   | en                                                                                                                                                              | es                                                                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview | Sign in by {date} to restore it.                                                                                                                                | Entra a más tardar el {date} para restaurarla.                                                                                                                                      |
| Title   | Your deleted account can still come back                                                                                                                        | Tu cuenta eliminada todavía puede volver                                                                                                                                            |
| Lead    | Someone tried to create a Ledger Flow account with this address. It has one, deleted on {date}: it's kept until **{date}**, and signing in by then restores it. | Alguien intentó crear una cuenta de Ledger Flow con esta dirección. Tiene una, eliminada el {date}: se conserva hasta el **{date}**, y si entras a más tardar ese día la restauras. |
| Line    | After that it's erased for good, and this address is free for a new account. If it wasn't you, ignore this email.                                               | Después se borra para siempre y esta dirección queda libre para una cuenta nueva. Si no fuiste tú, ignora este correo.                                                              |
| Box     | **Forgot your password?** Choosing a new one restores it too. It signs out every device. · Reset password                                                       | **¿Olvidaste tu contraseña?** Al elegir una nueva también la restauras. Se cierra la sesión en todos los dispositivos. · Restablecer contraseña                                     |

**When an undo link keeps the address** (an account moved away from it in the last 7 days), with:

| Piece       | en                                                                                                                                                                                                 | es                                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject     | This address is kept for a Ledger Flow account                                                                                                                                                     | Esta dirección está reservada para una cuenta de Ledger Flow                                                                                                                                              |
| Preview     | This address can't be used for a new account until {date}.                                                                                                                                         | Esta dirección no se puede usar para una cuenta nueva hasta el {date}.                                                                                                                                    |
| Title       | This address is kept for an account                                                                                                                                                                | Esta dirección está reservada para una cuenta                                                                                                                                                             |
| Lead        | Someone tried to create a Ledger Flow account with this address. An account moved away from it in the last few days and can still come back to it, so it's kept for that account until **{date}**. | Alguien intentó crear una cuenta de Ledger Flow con esta dirección. Una cuenta dejó de usarla hace pocos días y todavía puede volver a ella, así que queda reservada para esa cuenta hasta el **{date}**. |
| Line        | If that account is yours, the email about the change has a link to undo it. If not, ignore this email.                                                                                             | Si esa cuenta es tuya, el correo sobre el cambio tiene un enlace para deshacerlo. Si no, ignora este correo.                                                                                              |
| Button, box | None: there is nothing to sign in to at this address                                                                                                                                               | Ninguno                                                                                                                                                                                                   |

**`email-change-taken`** — instead of `email-change-confirm`, when the new address already has an account

| Piece   | en                                                                                                         | es                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Subject | Your address was asked for by another Ledger Flow account                                                  | Otra cuenta de Ledger Flow pidió usar tu dirección                                                     |
| Preview | Nothing changes: this address already has an account.                                                      | No cambia nada: esta dirección ya tiene una cuenta.                                                    |
| Title   | This address already has an account                                                                        | Esta dirección ya tiene una cuenta                                                                     |
| Lead    | Someone asked to move another Ledger Flow account to this address. It already has one, so nothing changes. | Alguien pidió pasar otra cuenta de Ledger Flow a esta dirección. Ya tiene una, así que no cambia nada. |
| Line    | If it was you, sign in with this address instead. If it wasn't, ignore this email.                         | Si fuiste tú, entra con esta dirección. Si no, ignora este correo.                                     |
| Button  | Sign in (→ `/login`)                                                                                       | Entrar                                                                                                 |
| Reason  | someone asked to use this address for a Ledger Flow account                                                | alguien pidió usar esta dirección en una cuenta de Ledger Flow                                         |

**`verify-email`** — an account from before email existed

| Piece   | en                                                              | es                                                                            |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Subject | Confirm your email for Ledger Flow                              | Confirma tu correo en Ledger Flow                                             |
| Preview | Type the code in the app or use the button.                     | Escribe el código en la app o usa el botón.                                   |
| Title   | Confirm your email                                              | Confirma tu correo                                                            |
| Lead    | Type this code in Ledger Flow to confirm this address is yours. | Escribe este código en Ledger Flow para confirmar que esta dirección es tuya. |
| Button  | Confirm email                                                   | Confirmar correo                                                              |
| Reason  | someone asked to confirm this address for a Ledger Flow account | alguien pidió confirmar esta dirección en una cuenta de Ledger Flow           |

No box (the owner's approval F): it is only sent when someone signed in to the account asks for it.

**`confirm-deadline`** and **`confirm-deadline-reminder`**

| Piece             | en                                                                                                                                                                       | es                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject           | Confirm your email for Ledger Flow by {date}                                                                                                                             | Confirma tu correo de Ledger Flow a más tardar el {date}                                                                                                                     |
| Subject, reminder | {days} days left to confirm your email for Ledger Flow                                                                                                                   | Quedan {days} días para confirmar tu correo de Ledger Flow                                                                                                                   |
| Preview           | It takes one tap, and nothing in your account changes.                                                                                                                   | Es un toque, y en tu cuenta no cambia nada.                                                                                                                                  |
| Title             | Confirm your email by {date}                                                                                                                                             | Confirma tu correo a más tardar el {date}                                                                                                                                    |
| Title, reminder   | {days} days left to confirm your email                                                                                                                                   | Quedan {days} días para confirmar tu correo                                                                                                                                  |
| Lead              | Ledger Flow now asks every account to confirm its email: that way nobody else can use your address, and our security notices reach you. Nothing in your account changes. | Ledger Flow ahora pide a todas las cuentas confirmar su correo: así nadie más puede usar tu dirección y te llegan nuestros avisos de seguridad. En tu cuenta no cambia nada. |
| Lead, reminder    | Confirm it by **{date}** to keep signing in as usual. Nothing in your account changes.                                                                                   | Confírmalo a más tardar el **{date}** para seguir entrando como siempre. En tu cuenta no cambia nada.                                                                        |
| Line              | The button works until {date}. After that, signing in first asks for a code sent to this address.                                                                        | El botón vale hasta el {date}. Después, para entrar te pediremos primero un código enviado a esta dirección.                                                                 |
| Button            | Confirm email                                                                                                                                                            | Confirmar correo                                                                                                                                                             |
| Box               | **Don't have a Ledger Flow account?** Don't use the button: ignore this email. Nothing in anybody's account changes.                                                     | **¿No tienes cuenta en Ledger Flow?** No uses el botón: ignora este correo. No cambia nada en ninguna cuenta.                                                                |
| Reason            | a Ledger Flow account uses this address and hasn't confirmed it                                                                                                          | una cuenta de Ledger Flow usa esta dirección y todavía no la confirma                                                                                                        |

`{days}` is 4 in practice; it is written as a number so a late send never lies.

**`password-reset`**

| Piece   | en                                                                                             | es                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Subject | Reset your Ledger Flow password                                                                | Restablece tu contraseña de Ledger Flow                                                                              |
| Preview | If you didn't ask for it, ignore this email.                                                   | Si no lo pediste, ignora este correo.                                                                                |
| Title   | Reset your password                                                                            | Restablece tu contraseña                                                                                             |
| Lead    | Type this code in Ledger Flow to choose a new password. Your other devices will be signed out. | Escribe este código en Ledger Flow para elegir una contraseña nueva. Se cerrará la sesión en tus otros dispositivos. |
| Button  | Choose a new password                                                                          | Elegir una contraseña nueva                                                                                          |
| Box     | **Didn't ask for this?** Ignore this email: your password stays the same.                      | **¿No lo pediste?** Ignora este correo: tu contraseña sigue igual.                                                   |
| Reason  | someone asked to reset the password of the Ledger Flow account with this address               | alguien pidió restablecer la contraseña de la cuenta de Ledger Flow con esta dirección                               |

**When the account is deleted** and still in its 30 days, the same email with:

| Piece | en                                                                                                                    | es                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lead  | Type this code in Ledger Flow to choose a new password. This account was deleted on {date}: choosing one restores it. | Escribe este código en Ledger Flow para elegir una contraseña nueva. Esta cuenta se eliminó el {date}: al elegirla, la restauras. |
| Box   | **Didn't ask for this?** Ignore this email: nothing changes, and the account is erased on {date} as planned.          | **¿No lo pediste?** Ignora este correo: no cambia nada y la cuenta se borra el {date}, como estaba previsto.                      |

**`password-reset-after-undo`**

| Piece   | en                                                                                                                                                                          | es                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Choose a new password for Ledger Flow                                                                                                                                       | Elige una contraseña nueva para Ledger Flow                                                                                                                                                          |
| Preview | You undid a change to your account.                                                                                                                                         | Deshiciste un cambio en tu cuenta.                                                                                                                                                                   |
| Title   | Choose a new password                                                                                                                                                       | Elige una contraseña nueva                                                                                                                                                                           |
| Lead    | You undid a change to your account from this address, and every device was signed out. Type this code in Ledger Flow to choose a new password: the old one no longer works. | Deshiciste un cambio en tu cuenta desde esta dirección y se cerró la sesión en todos los dispositivos. Escribe este código en Ledger Flow para elegir una contraseña nueva: la anterior ya no sirve. |
| Button  | Choose a new password                                                                                                                                                       | Elegir una contraseña nueva                                                                                                                                                                          |
| Box     | **Code expired?** Ask for another one with "Forgot your password?" on the Sign in screen.                                                                                   | **¿Se venció el código?** Pide otro con «¿Olvidaste tu contraseña?» en la pantalla de Entrar.                                                                                                        |
| Reason  | you undid a change to your Ledger Flow account from this address                                                                                                            | deshiciste un cambio en tu cuenta de Ledger Flow desde esta dirección                                                                                                                                |

**After "Restore account"**, the same email with:

| Piece   | en                                                                                                                                                                 | es                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview | You restored your account.                                                                                                                                         | Restauraste tu cuenta.                                                                                                                                                                   |
| Lead    | You restored your account from this address, and every device was signed out. Type this code in Ledger Flow to choose a new password: the old one no longer works. | Restauraste tu cuenta desde esta dirección y se cerró la sesión en todos los dispositivos. Escribe este código en Ledger Flow para elegir una contraseña nueva: la anterior ya no sirve. |
| Reason  | you restored your Ledger Flow account from this address                                                                                                            | restauraste tu cuenta de Ledger Flow desde esta dirección                                                                                                                                |

**`password-changed`**

| Piece   | en                                                                                                      | es                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Your Ledger Flow password was changed                                                                   | Se cambió la contraseña de tu cuenta de Ledger Flow                                                                               |
| Preview | If it wasn't you, reset it now.                                                                         | Si no fuiste tú, restablécela ya.                                                                                                 |
| Title   | Your password was changed                                                                               | Se cambió tu contraseña                                                                                                           |
| Lead    | Your other devices were signed out. If you made this change, there's nothing else to do.                | Se cerró la sesión en tus otros dispositivos. Si fuiste tú, no tienes que hacer nada más.                                         |
| Box     | Reset your password now. It signs out every device, including the one that changed it. · Reset password | Restablece tu contraseña ya. Se cierra la sesión en todos los dispositivos, también en el que la cambió. · Restablecer contraseña |

**`email-change-confirm`** (to the new address)

| Piece   | en                                                                                                                                                                      | es                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Confirm your new email for Ledger Flow                                                                                                                                  | Confirma tu nuevo correo en Ledger Flow                                                                                                                                                             |
| Preview | Your account moves to this address once you confirm it.                                                                                                                 | Tu cuenta pasa a esta dirección cuando la confirmes.                                                                                                                                                |
| Title   | Confirm your new email                                                                                                                                                  | Confirma tu nuevo correo                                                                                                                                                                            |
| Lead    | Type this code in Ledger Flow to move the account **{maskedEmail}** to this address. Until you do, it keeps that email. Confirming signs out your other devices.        | Escribe este código en Ledger Flow para pasar la cuenta **{maskedEmail}** a esta dirección. Mientras no lo hagas, sigue con ese correo. Al confirmar se cierra la sesión en tus otros dispositivos. |
| Button  | Confirm new email                                                                                                                                                       | Confirmar nuevo correo                                                                                                                                                                              |
| Box     | **Didn't ask for this, or isn't that your account?** Don't use the code or the button: ignore this email. Nothing changes, and this address isn't added to any account. | **¿No lo pediste, o esa no es tu cuenta?** No uses el código ni el botón: ignora este correo. No cambia nada y esta dirección no se añade a ninguna cuenta.                                         |
| Reason  | someone asked to use this address for a Ledger Flow account                                                                                                             | alguien pidió usar esta dirección en una cuenta de Ledger Flow                                                                                                                                      |

`{maskedEmail}` is the account's current address, masked as "What an email never has" says.

**`email-change-requested`** (to the old address)

| Piece   | en                                                                                                                                                                                          | es                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Someone asked to change your Ledger Flow email                                                                                                                                              | Se pidió cambiar el correo de tu cuenta de Ledger Flow                                                                                                                                                                |
| Preview | If it wasn't you, undo it from this email.                                                                                                                                                  | Si no fuiste tú, deshazlo desde este correo.                                                                                                                                                                          |
| Title   | A change to your email was requested                                                                                                                                                        | Se pidió cambiar tu correo                                                                                                                                                                                            |
| Lead    | A request was made to change your account's email to **{newEmail}**. It changes once that address is confirmed.                                                                             | Se pidió cambiar el correo de tu cuenta a **{newEmail}**. El cambio se hace cuando se confirme esa dirección.                                                                                                         |
| Box     | Undo it: your account keeps this address, every device is signed out and you choose a new password. This link works for 7 days, even if the change was already confirmed. · Undo the change | Deshazlo: tu cuenta se queda con esta dirección, se cierra la sesión en todos los dispositivos y eliges una contraseña nueva. El enlace vale por 7 días, aunque el cambio ya se haya confirmado. · Deshacer el cambio |

**`new-sign-in`**

| Piece   | en                                                                                               | es                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Subject | New sign-in to Ledger Flow: {device}                                                             | Nuevo acceso a Ledger Flow: {device}                                                                           |
| Preview | If it was you, there's nothing to do.                                                            | Si fuiste tú, no tienes que hacer nada.                                                                        |
| Title   | New sign-in to your account                                                                      | Nuevo acceso a tu cuenta                                                                                       |
| Lead    | Your account was signed in on a device we don't recognize. If it was you, there's nothing to do. | Se inició sesión en tu cuenta desde un dispositivo que no reconocemos. Si fuiste tú, no tienes que hacer nada. |
| Box     | The reset box · Reset password                                                                   | The reset box · Restablecer contraseña                                                                         |

**`account-deleted`**

| Piece   | en                                                                                                                                                                                                             | es                                                                                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Your Ledger Flow account was deleted                                                                                                                                                                           | Tu cuenta de Ledger Flow se eliminó                                                                                                                                                                                                           |
| Preview | It's kept until {date}. Signing in before then restores it.                                                                                                                                                    | Se conserva hasta el {date}. Si entras antes, la restauras.                                                                                                                                                                                   |
| Title   | Your account was deleted                                                                                                                                                                                       | Tu cuenta se eliminó                                                                                                                                                                                                                          |
| Lead    | Every device was signed out. Your account and everything in it are kept until **{date}**, and then erased for good. If you change your mind, sign in with this email and your password before then.            | Se cerró la sesión en todos los dispositivos. Tu cuenta y todo lo que tiene se conservan hasta el **{date}**, y después se borran para siempre. Si cambias de idea, entra con este correo y tu contraseña antes de esa fecha.                 |
| Box     | **Didn't delete it?** Restore it now: every device is signed out and you choose a new password. This link works for 7 days; after that, Forgot your password? also restores it until {date}. · Restore account | **¿No la eliminaste?** Restáurala ya: se cierra la sesión en todos los dispositivos y eliges una contraseña nueva. El enlace vale por 7 días; después, «¿Olvidaste tu contraseña?» también la restaura hasta el {date}. · Restaurar la cuenta |

The line that sent the owner to support for a permanent removal is gone: the erasure is automatic now.
The privacy policy still promises that removal on request in 15 business days; T-220 brings it in line.

**`account-restored`**

| Piece            | en                                                                                                                                                                                              | es                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject          | Your Ledger Flow account was restored                                                                                                                                                           | Tu cuenta de Ledger Flow se restauró                                                                                                                                                                              |
| Preview          | If it wasn't you, reset your password now.                                                                                                                                                      | Si no fuiste tú, restablece tu contraseña ya.                                                                                                                                                                     |
| Title            | Your account was restored                                                                                                                                                                       | Se restauró tu cuenta                                                                                                                                                                                             |
| Lead, signing in | Your account, deleted on {date}, was restored by signing in: everything in it is back except the shared groups it left, and it won't be erased.                                                 | Tu cuenta, eliminada el {date}, se restauró al entrar: vuelve todo lo que tenía menos los grupos compartidos que dejó, y ya no se va a borrar.                                                                    |
| Lead, a reset    | Your account, deleted on {date}, was restored by choosing a new password: everything in it is back except the shared groups it left, and it won't be erased. Every other device was signed out. | Tu cuenta, eliminada el {date}, se restauró al elegir una contraseña nueva: vuelve todo lo que tenía menos los grupos compartidos que dejó, y ya no se va a borrar. Se cerró la sesión en los demás dispositivos. |
| Box              | The reset box · Reset password                                                                                                                                                                  | The reset box · Restablecer contraseña                                                                                                                                                                            |

**For later: passkeys, two-step verification and recovery codes**

| Template             | Piece   | en                                                                                                                      | es                                                                                                                                                                   |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passkey-added`      | Subject | A passkey was added to your Ledger Flow account                                                                         | Se añadió una llave de acceso a tu cuenta de Ledger Flow                                                                                                             |
|                      | Title   | A passkey was added                                                                                                     | Se añadió una llave de acceso                                                                                                                                        |
|                      | Lead    | A new passkey can now sign in to your account without a password.                                                       | Una llave de acceso nueva ya puede entrar a tu cuenta sin contraseña.                                                                                                |
| `two-factor-on`      | Subject | Two-step verification is on for Ledger Flow                                                                             | La verificación en dos pasos está activa en Ledger Flow                                                                                                              |
|                      | Title   | Two-step verification is on                                                                                             | La verificación en dos pasos está activa                                                                                                                             |
|                      | Lead    | Signing in now also asks for a code from your authenticator app.                                                        | Entrar ahora pide también un código de tu app de autenticación.                                                                                                      |
| `passkey-removed`    | Subject | A passkey was removed from your Ledger Flow account                                                                     | Se quitó una llave de acceso de tu cuenta de Ledger Flow                                                                                                             |
|                      | Title   | A passkey was removed                                                                                                   | Se quitó una llave de acceso                                                                                                                                         |
|                      | Lead    | That passkey can no longer sign in to your account.                                                                     | Esa llave de acceso ya no puede entrar a tu cuenta.                                                                                                                  |
| `two-factor-off`     | Subject | Two-step verification is off for Ledger Flow                                                                            | La verificación en dos pasos se desactivó en Ledger Flow                                                                                                             |
|                      | Title   | Two-step verification is off                                                                                            | La verificación en dos pasos se desactivó                                                                                                                            |
|                      | Lead    | Signing in no longer asks for a code from your authenticator app.                                                       | Entrar ya no pide un código de tu app de autenticación.                                                                                                              |
| `recovery-code-used` | Subject | A recovery code was used on your Ledger Flow account                                                                    | Se usó un código de recuperación en tu cuenta de Ledger Flow                                                                                                         |
|                      | Preview | You have {left} left. If it wasn't you, reset your password now.                                                        | {left, plural, one {Te queda #} other {Te quedan #}}. Si no fuiste tú, restablece tu contraseña ya.                                                                  |
|                      | Title   | A recovery code was used                                                                                                | Se usó un código de recuperación                                                                                                                                     |
|                      | Lead    | One of your recovery codes was used to {sign in \| reset your password}. You have {left} left, and each one works once. | Se usó uno de tus códigos de recuperación para {entrar \| restablecer la contraseña}. {left, plural, one {Te queda #} other {Te quedan #}} y cada uno sirve una vez. |
|                      | No more | That was your last one: create new codes in Settings › Security.                                                        | Era el último: crea códigos nuevos en Ajustes › Seguridad.                                                                                                           |
|                      | Box     | Reset your password now, then create new codes in Settings › Security. · Reset password                                 | Restablece tu contraseña ya y después crea códigos nuevos en Ajustes › Seguridad. · Restablecer contraseña                                                           |

With `left` at 0, "No more" replaces the second sentence of the lead, and the preview text starts with
"None left." / "No te queda ninguno.". The added ones carry the undo box and the preview "If it wasn't
you, undo it from this email." / "Si no fuiste tú, deshazlo desde este correo."; the removed ones, the
reset box and "If it wasn't you, reset your password now." / "Si no fuiste tú, restablece tu contraseña
ya.". A passkey is a "llave de acceso" in Spanish, the word Apple and Google use.
