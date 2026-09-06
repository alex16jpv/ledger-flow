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

O-F6 part 2 adds `/settings/sync`, the screen support needs when someone spent three months without
network: the sync cursor and last full pull, how many writes are still queued and the last error the
server (or the network) answered with, storage used and whether the persistent grant was given,
whether the app is running installed or in a tab — on iOS the two hold different data (§4.3) — a link
to the `/sync` tray instead of a second copy of it (F-30), and "Force full resync", which deletes the
local copy and downloads it again while keeping the queue, because the queue is the only place unsent
work exists. The hub gains its row, the install row now explains durability rather than convenience,
and signing out with a queue behind you asks first: keep the work for the next sign-in on this device,
or discard it (F-34). Categories says out loud that "restore defaults" needs a connection, since the
server mints those ids and there is nothing the queue could project (F-20).

Signing out — the hub's button and «Sign out all other sessions» — is disabled with no network and
says why: the session lives on the server, and an offline sign-out could only clear this device while
the account stayed signed in (R-3b). Restore-defaults follows the same rule (F-20).
