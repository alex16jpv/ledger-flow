# Settings

Hub with profile, preferences (language, currency, time zone, appearance, categories), security,
data and sign out. W-15 ships the hub, the language sheet, appearance and sign out; W-30 completes
profile, sessions, currency, time zone, "Your data" and account deletion.

W-30 completes the hub: the currency sheet (read-only with the `CURRENCY_LOCKED` explanation once the
user has accounts, a searchable picker otherwise), the time-zone sheet (saves and refreshes the access
token so budgets and stats use the new zone at once), `ProfileView` (`/settings/profile`: name, email and
password; a credential change asks for the current password and signs this device in again with the
new pair, because the API revokes every refresh token), `SessionsView` (`/settings/sessions`: one row
per device from the user agent, sign out one, or every device with a confirmation that warns this one
goes too), the "Your data" section (rights under Law 1581, contact mailbox, policy link), the
"Install app" row (`beforeinstallprompt`), About with the version, and `DeleteAccountSheet` (type the
word, `DELETE /users/:id`, then sign out to `/login?deleted=1`).
