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
  - The one exception is the new address in `email-change-requested`, because it is what the owner needs
    to see. It goes in only after the API's strict email validation, HTML-escaped, as plain text and
    never a link, and never in a subject or the preview text.
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
- **Device:** "Browser on OS" ("Chrome on Windows", "Chrome en Windows"), the same reading as Active
  sessions, from the fixed list above. No IP address and no place: we do not locate people.

## The emails

| Template                    | When                                                              | To                   | Link                              | Works for                        | Budget                    |
| --------------------------- | ----------------------------------------------------------------- | -------------------- | --------------------------------- | -------------------------------- | ------------------------- |
| `verify-email`              | Sign up, and Resend                                               | The account          | `/{locale}/verify#token=…`        | 24 hours                         | Verification and security |
|                             | "It wasn't me" in the same email                                  |                      | `/{locale}/not-me#token=…`        | While the account is unconfirmed |                           |
| `password-reset`            | Forgot your password?, only when the address has a live account   | The account          | `/{locale}/reset#token=…`         | 30 minutes                       | Reset                     |
| `password-reset-after-undo` | "Undo the change" was confirmed                                   | The original address | `/{locale}/reset#token=…`         | 30 minutes                       | Reset                     |
| `password-changed`          | Password & email, and after a reset                               | The account          | `/{locale}/forgot`                | —                                | Verification and security |
| `email-change-confirm`      | Password & email, a new address                                   | The new address      | `/{locale}/confirm-email#token=…` | 24 hours                         | Verification and security |
| `email-change-requested`    | The same moment                                                   | The old address      | `/{locale}/undo#token=…`          | 7 days                           | Verification and security |
| `new-sign-in`               | A sign-in from a device with no valid device token for that email | The account          | `/{locale}/forgot`                | —                                | Verification and security |
| `account-deleted`           | Delete my account                                                 | The account          | `/{locale}/register`              | —                                | Verification and security |
| `passkey-added`             | A passkey is added · for later                                    | The account          | `/{locale}/undo#token=…`          | 7 days                           | Verification and security |
| `two-factor-on`             | The authenticator app is turned on · for later                    | The account          | `/{locale}/undo#token=…`          | 7 days                           | Verification and security |
| `passkey-removed`           | A passkey is removed · for later                                  | The account          | `/{locale}/forgot`                | —                                | Verification and security |
| `two-factor-off`            | The authenticator app is turned off · for later                   | The account          | `/{locale}/forgot`                | —                                | Verification and security |
| `recovery-code-used`        | A recovery code signs in or resets the password · for later       | The account          | `/{locale}/forgot`                | —                                | Verification and security |

**Links, one page per purpose.** The page cannot ask the server what a token does without redeeming it,
so the path says it, and each page can say what its tap does before the tap:

| Path             | What its one tap does                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/verify`        | Confirms the account's address                                                                                                                                                                         |
| `/confirm-email` | Moves the account to the new address. Every other device is signed out; if this browser has the account's session it keeps it, if not it stays signed out, which is why the email says "other devices" |
| `/not-me`        | Deletes an account nobody ever confirmed and frees the address. The page says it deletes, before the tap                                                                                               |
| `/undo`          | Undoes the change the email was about and sends `password-reset-after-undo`                                                                                                                            |
| `/reset`         | Opens "choose a new password" with the token, and redeems it only when the new password is sent                                                                                                        |
| `/forgot`        | Forgot your password? with nothing filled in. No token                                                                                                                                                 |
| `/register`      | Create account. No token                                                                                                                                                                               |

The path names are a contract: the pages at them are drawn in [access.md](access.md).

**Tokens and codes.**

- **Every link carries its own token, for one purpose and one use**; the plates show the same token
  in every link only because they are mockups. A token is kept as a hash, like the code. **It travels
  in the fragment, after `#`**, which the browser never sends to a server: it reaches no access log, no
  referrer and no error report, and the page takes it from there ([access.md](access.md)).
- **Every code takes 5 wrong tries** and then stops working, whatever it is for; asking for another one
  cancels the one before, and the email says so — but only once the new email has been accepted for
  delivery, so a send that fails never leaves the person with no working code.
- **Resend does not cancel an earlier "It wasn't me"**: that link is the protection of whoever owns the
  address, and it keeps working in every verification email until the account is confirmed. It belongs
  to that account and that address together: it stops working when the account is confirmed or moves
  to another address, so a mistyped inbox can never delete the account once it has left.
- **"Undo the change" stops the current password**: whoever made the change knows it. From the tap,
  the account can only be entered after choosing a new one with `password-reset-after-undo`, or with
  Forgot your password? if that code expires.

**Who gets what.**

- **Budget** is the slice of the daily cap each email spends: the reset has its own, so filling the rest
  never blocks one.
- **`new-sign-in`** goes to a device without a valid device token for the account. Signing up sends
  `verify-email` and never `new-sign-in`, because registering gives the device its token. A reset, a
  confirmed undo and `/confirm-email` send none either: they already send their own email. **Today every
  password change, email change and Sign out everywhere forgets the devices** (they are tied to
  `tokenVersion`), so after one of those each known device can get one `new-sign-in` on its next
  sign-in; T-211 decides whether devices outlive that.
- **"It wasn't me" in `verify-email`** deletes the account only while nobody has confirmed it (the
  owner's decision 11), and erases it rather than archiving it, so it cannot be brought back. That
  deletion sends no `account-deleted`: the account was never that address's.
- **`email-change-requested` goes only to an address that was confirmed.** An account that never
  confirmed its email is usually correcting a typo, and the old address may be a stranger's: telling
  them the new one would hand over somebody's real address. The old codes and links simply stop working.
- **While an undo link works, the old address stays reserved** for the account, so nobody can sign up
  with it in those 7 days and the undo never collides with another account.
- `passkey-added`, `two-factor-on`, `passkey-removed`, `two-factor-off` and `recovery-code-used` are
  drawn now so the notices are complete, and are sent once passkeys and two-step verification exist.
  **Their words are provisional**: T-214 designs that sign-in, and changes them here if it has to.

## The words

The subject, the preview text, the title, the lead and the box of every email, in both languages. The
plates show them in place, and `build.mjs` holds the same text.

**Shared by all of them**

| Piece                | en                                                                                                                                                                        | es                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fallback link        | If the button doesn't work, open this link:                                                                                                                               | Si el botón no funciona, abre este enlace:                                                                                                                                                                                   |
| Code note            | Only type this code in Ledger Flow. Nobody from Ledger Flow will ever ask you for it.                                                                                     | Escribe este código solo en Ledger Flow. Nadie de Ledger Flow te lo va a pedir.                                                                                                                                              |
| Code, 24 hours       | It works for 24 hours. Asking for another one cancels this one.                                                                                                           | Sirve 24 horas. Si pides otro, este deja de servir.                                                                                                                                                                          |
| Code, 30 minutes     | It works for 30 minutes. Asking for another one cancels this one.                                                                                                         | Sirve 30 minutos. Si pides otro, este deja de servir.                                                                                                                                                                        |
| Facts                | When · Device                                                                                                                                                             | Cuándo · Dispositivo                                                                                                                                                                                                         |
| Footer, a code email | You're getting this because {reason}.                                                                                                                                     | Te llega porque {reason}.                                                                                                                                                                                                    |
| Footer, a notice     | This is a security notice for your Ledger Flow account. These can't be turned off: they're how we tell you what happens to your account.                                  | Es un aviso de seguridad de tu cuenta de Ledger Flow. Estos avisos no se pueden desactivar: así te contamos lo que pasa con tu cuenta.                                                                                       |
| Footer, second line  | Ledger Flow · ledgerflow.alexpiral.com · Questions? ledgerflow@alexpiral.com                                                                                              | Ledger Flow · ledgerflow.alexpiral.com · ¿Dudas? ledgerflow@alexpiral.com                                                                                                                                                    |
| Box heading          | Not you?                                                                                                                                                                  | ¿No fuiste tú?                                                                                                                                                                                                               |
| Buttons              | Reset password · Undo the change                                                                                                                                          | Restablecer contraseña · Deshacer el cambio                                                                                                                                                                                  |
| Box, reset           | Reset your password now. It signs out every device.                                                                                                                       | Restablece tu contraseña ya. Se cierra la sesión en todos los dispositivos.                                                                                                                                                  |
| Box, undo a factor   | Undo it: we remove every passkey, authenticator app and recovery code added since then, sign out every device, and you choose a new password. This link works for 7 days. | Deshazlo: quitamos las llaves de acceso, la app de autenticación y los códigos de recuperación añadidos desde entonces, se cierra la sesión en todos los dispositivos y eliges una contraseña nueva. El enlace sirve 7 días. |

**`verify-email`**

| Piece   | en                                                                                                                                              | es                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Confirm your email for Ledger Flow                                                                                                              | Confirma tu correo en Ledger Flow                                                                                                               |
| Preview | Type the code in the app or use the button. It works for 24 hours.                                                                              | Escribe el código en la app o usa el botón. Sirve 24 horas.                                                                                     |
| Title   | Confirm your email                                                                                                                              | Confirma tu correo                                                                                                                              |
| Lead    | Type this code in Ledger Flow to confirm this address is yours.                                                                                 | Escribe este código en Ledger Flow para confirmar que esta dirección es tuya.                                                                   |
| Button  | Confirm email                                                                                                                                   | Confirmar correo                                                                                                                                |
| Box     | **Didn't sign up?** Someone typed your address when signing up. Use "It wasn't me" to delete that account and free your address. · It wasn't me | **¿No te registraste?** Alguien escribió tu dirección al registrarse. Usa «No fui yo» para eliminar esa cuenta y liberar tu correo. · No fui yo |
| Reason  | someone signed up for Ledger Flow with this address                                                                                             | alguien se registró en Ledger Flow con esta dirección                                                                                           |

**`password-reset`**

| Piece   | en                                                                                                                              | es                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Subject | Reset your Ledger Flow password                                                                                                 | Restablece tu contraseña de Ledger Flow                                                                                   |
| Preview | The code works for 30 minutes. If you didn't ask for it, ignore this email.                                                     | El código sirve 30 minutos. Si no lo pediste, ignora este correo.                                                         |
| Title   | Reset your password                                                                                                             | Restablece tu contraseña                                                                                                  |
| Lead    | Type this code in Ledger Flow to choose a new password. Your other devices will be signed out.                                  | Escribe este código en Ledger Flow para elegir una contraseña nueva. Se cerrará la sesión en tus otros dispositivos.      |
| Button  | Choose a new password                                                                                                           | Elegir una contraseña nueva                                                                                               |
| Box     | **Didn't ask for this?** Ignore this email. Your password stays the same, and the code and the link stop working in 30 minutes. | **¿No lo pediste?** Ignora este correo. Tu contraseña sigue igual, y el código y el enlace dejan de servir en 30 minutos. |
| Reason  | someone asked to reset the password of the Ledger Flow account with this address                                                | alguien pidió restablecer la contraseña de la cuenta de Ledger Flow con esta dirección                                    |

**`password-reset-after-undo`**

| Piece   | en                                                                                                                                                                          | es                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Choose a new password for Ledger Flow                                                                                                                                       | Elige una contraseña nueva para Ledger Flow                                                                                                                                                          |
| Preview | You undid a change to your account. The code works for 30 minutes.                                                                                                          | Deshiciste un cambio en tu cuenta. El código sirve 30 minutos.                                                                                                                                       |
| Title   | Choose a new password                                                                                                                                                       | Elige una contraseña nueva                                                                                                                                                                           |
| Lead    | You undid a change to your account from this address, and every device was signed out. Type this code in Ledger Flow to choose a new password: the old one no longer works. | Deshiciste un cambio en tu cuenta desde esta dirección y se cerró la sesión en todos los dispositivos. Escribe este código en Ledger Flow para elegir una contraseña nueva: la anterior ya no sirve. |
| Button  | Choose a new password                                                                                                                                                       | Elegir una contraseña nueva                                                                                                                                                                          |
| Box     | **Code expired?** Ask for another one with "Forgot your password?" on the Sign in screen.                                                                                   | **¿Se venció el código?** Pide otro con «¿Olvidaste tu contraseña?» en la pantalla de Entrar.                                                                                                        |
| Reason  | you undid a change to your Ledger Flow account from this address                                                                                                            | deshiciste un cambio en tu cuenta de Ledger Flow desde esta dirección                                                                                                                                |

**`password-changed`**

| Piece   | en                                                                                                      | es                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Your Ledger Flow password was changed                                                                   | Se cambió la contraseña de tu cuenta de Ledger Flow                                                                               |
| Preview | If it wasn't you, reset it now.                                                                         | Si no fuiste tú, restablécela ya.                                                                                                 |
| Title   | Your password was changed                                                                               | Se cambió tu contraseña                                                                                                           |
| Lead    | Your other devices were signed out. If you made this change, there's nothing else to do.                | Se cerró la sesión en tus otros dispositivos. Si fuiste tú, no tienes que hacer nada más.                                         |
| Box     | Reset your password now. It signs out every device, including the one that changed it. · Reset password | Restablece tu contraseña ya. Se cierra la sesión en todos los dispositivos, también en el que la cambió. · Restablecer contraseña |

**`email-change-confirm`** (to the new address)

| Piece   | en                                                                                                                                                     | es                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Confirm your new email for Ledger Flow                                                                                                                 | Confirma tu correo nuevo de Ledger Flow                                                                                                                                                 |
| Preview | Your account moves to this address once you confirm it. It works for 24 hours.                                                                         | Tu cuenta pasa a esta dirección cuando la confirmes. Sirve 24 horas.                                                                                                                    |
| Title   | Confirm your new email                                                                                                                                 | Confirma tu correo nuevo                                                                                                                                                                |
| Lead    | Type this code in Ledger Flow to move your account to this address. Until you do, it keeps its current email. Confirming signs out your other devices. | Escribe este código en Ledger Flow para pasar tu cuenta a esta dirección. Mientras no lo hagas, sigue con su correo actual. Al confirmar se cierra la sesión en tus otros dispositivos. |
| Button  | Confirm new email                                                                                                                                      | Confirmar correo nuevo                                                                                                                                                                  |
| Box     | **Didn't ask for this?** Ignore this email. Nothing changes, and this address isn't added to any account.                                              | **¿No lo pediste?** Ignora este correo. No cambia nada y esta dirección no se añade a ninguna cuenta.                                                                                   |
| Reason  | someone asked to use this address for a Ledger Flow account                                                                                            | alguien pidió usar esta dirección en una cuenta de Ledger Flow                                                                                                                          |

**`email-change-requested`** (to the old address)

| Piece   | en                                                                                                                                                                                          | es                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Subject | Your Ledger Flow email is being changed                                                                                                                                                     | Se pidió cambiar el correo de tu cuenta de Ledger Flow                                                                                                                                                             |
| Preview | If it wasn't you, undo it from this email.                                                                                                                                                  | Si no fuiste tú, deshazlo desde este correo.                                                                                                                                                                       |
| Title   | Your email is being changed                                                                                                                                                                 | Se pidió cambiar tu correo                                                                                                                                                                                         |
| Lead    | Someone asked to move your account to **{newEmail}**. It moves once that address is confirmed.                                                                                              | Se pidió pasar tu cuenta a **{newEmail}**. El cambio se hace cuando se confirme esa dirección.                                                                                                                     |
| Box     | Undo it: your account keeps this address, every device is signed out and you choose a new password. This link works for 7 days, even if the change was already confirmed. · Undo the change | Deshazlo: tu cuenta se queda con esta dirección, se cierra la sesión en todos los dispositivos y eliges una contraseña nueva. El enlace sirve 7 días, aunque el cambio ya se haya confirmado. · Deshacer el cambio |

**`new-sign-in`**

| Piece   | en                                                                                               | es                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Subject | New sign-in to Ledger Flow: {device}                                                             | Nuevo acceso a Ledger Flow: {device}                                                                           |
| Preview | If it was you, there's nothing to do.                                                            | Si fuiste tú, no tienes que hacer nada.                                                                        |
| Title   | New sign-in to your account                                                                      | Nuevo acceso a tu cuenta                                                                                       |
| Lead    | Your account was signed in on a device we don't recognize. If it was you, there's nothing to do. | Se inició sesión en tu cuenta desde un dispositivo que no reconocemos. Si fuiste tú, no tienes que hacer nada. |
| Box     | The reset box · Reset password                                                                   | The reset box · Restablecer contraseña                                                                         |

**`account-deleted`**

| Piece   | en                                                                                                                                                                          | es                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Subject | Your Ledger Flow account was deleted                                                                                                                                        | Tu cuenta de Ledger Flow se eliminó                                                                                                                                                              |
| Preview | Signing up again with this email and the password it had brings it back.                                                                                                    | Si te registras de nuevo con este correo y la contraseña que tenía, la recuperas.                                                                                                                |
| Title   | Your account was deleted                                                                                                                                                    | Tu cuenta se eliminó                                                                                                                                                                             |
| Lead    | Every device was signed out. Your account and your financial history are kept for a while: signing up again with this email and the password it had brings everything back. | Se cerró la sesión en todos los dispositivos. Tu cuenta y tu historial financiero se conservan un tiempo: si te registras de nuevo con este correo y la contraseña que tenía, lo recuperas todo. |
| Line    | To have it erased for good, write to ledgerflow@alexpiral.com: it's done within 15 business days.                                                                           | Para borrarla del todo, escribe a ledgerflow@alexpiral.com: se hace en 15 días hábiles.                                                                                                          |
| Box     | **Didn't delete it?** Signing up again with this email and the password it had when it was deleted brings it back. Then change the password in Settings. · Create account   | **¿No la eliminaste?** Si te registras de nuevo con este correo y la contraseña que tenía al eliminarse, la recuperas. Después cambia la contraseña en Ajustes. · Crear cuenta                   |

The 15 business days are the privacy policy's promise for a permanent removal.

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
