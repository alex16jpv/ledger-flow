# Auth

Login, registration (with the Ley 1581 consent and detected currency/time zone) and the access
frame. Talks only to the session BFF (`/api/auth/*`); tokens never reach this code.

The frame carries a language chip (F-02) and the register form a **Language** row; both open the same
sheet and both switch the screen's language, which _is_ the `locale` the account is created with —
there is no third value to keep in step. The switch carries the query string, so a `?reauth=1&next=…`
login does not lose its way back (§2.6). No "Follow device" here: that is a local mode of Settings,
not a value the contract takes.

A successful sign-in — a login or a registration — **ends "this device only"** (P-36). The mode is a
device choice, so nothing on the server can clear it, and the sheet of P-32 sends the user here to
leave it: left set, the app came back with a live session and a stripe still saying nothing was
syncing. The answer that arrived is also the proof of network the mode refuses to take from anywhere
else, so the connectivity phase is reported with it. It also **lifts the flag of H-61**: a session
that ended stops the app from asking for a token at all, and signing in is what puts it back within
reach (`noteSessionStarted`).

On a device that already holds someone's data **the email arrives written and the password takes the
focus** (P-37): the marker says whose device this is (§2.6) and the mirror keeps that user's profile,
so coming back to sync asks only for what the device does not know. The field stays editable — another
account can still sign in here — and it is read without opening the vault the app opens, because the
access screens live outside the frame that owns it and a database created by the question would look
like an evicted vault (D-20). A device with no vault gets the empty field, which is where a first
sign-in happens.

**Whoever signs in, nobody else's copy stays on the device** (T-167). Before the sign-in resolves,
every other account's mirror is cleared and its unsent changes are kept for that account's next
sign-in (`purgeOtherVaults`); then the other tabs are told (`session:signedIn`), and one still showing
another account moves to Home of this one (`AccountSwitch`, in the app frame). The login itself
lands on Home too, not on the `next` it was given, when the device's marker named another account
(`nextAfterSignIn`): that way back was the previous account's.

**Forgot your password?** (`/forgot`, T-208) asks for a code and then takes the code and the new
password together, because the backend checks both in one call; the email's link (`/reset#token=…`)
takes the new password alone. Every address gets the same words and the same countdown, and every bad
code the one answer, so nothing on these screens tells who has an account (`design/spec/screens/access.md`).
The link page takes the token out of the address bar before anything else and spends it only with
the new password, since mail scanners open links. What one access screen hands the next — a typed
email, the code already sent, the link's token — lives in memory (`carry.ts`), never in the URL,
which reaches logs, and survives the language chip, which remounts the page.

**Cloudflare's check** (`lib/captcha`) runs unseen when Send code or Resend is pressed, and only shows
its box when Cloudflare has doubts. Its script loads the first time one of those screens opens, never
in the bundle. The flow exists only where `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set: without a key
there is no captcha, the backend refuses to send, and Sign in keeps the link inactive.

**A reset of an account that never confirmed its email** may open "Keep what's in this account?"
(`/keep-or-start-fresh`, the owner's decision 12). Until it is answered the app frame opens nothing of
the account — no mirror, no screens — and sends every visit, and every sign-in, there. Start fresh is
one request with the new details; this device's copy goes right after, and any other device's goes
the next time it syncs (`RESYNC_REQUIRED`, `lib/local/README.md`).
