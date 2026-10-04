# Auth

Login, registration (accepting the terms and the privacy policy, with the Ley 1581 consent, and detected currency/time zone) and the access
frame. Talks only to the session BFF (`/api/auth/*`); tokens never reach this code.

**An account exists only once its email is confirmed** (T-239, the owner's decision 16). Create
account sends what was typed to `/api/auth/sign-up`, which answers the same for every address and
keeps the sign-up's token in an httpOnly cookie of its own (`__Secure-sign-up`, path
`/api/auth/sign-up`, the 24 hours the server holds it), with the address it went to: the page never
sees the token, and a reload asks the BFF what this browser waits for (`GET /api/auth/sign-up`) and
lands on the code step again. The code (`/api/auth/sign-up/confirm`) creates the account and signs in
with this device's token; Resend (`/sign-up/resend`) carries Cloudflare's check; Change it forgets the
cookie and goes back to the form with what was typed except the password; a sign-up that is over
(`SIGN_UP_EXPIRED`) does the same and says so. Every bad code gets one answer, `SIGN_UP_CODE_INVALID`.

**A deleted account** (decisions 19 and 20): the right password answers `ACCOUNT_DELETED` with its two
dates, and Sign in turns into "Restore your account?" with what was typed held in memory, never stored;
Restore account sends the same credentials to `/api/auth/login/restore`, Not now goes back to the form.
Delete account in Settings lands on Sign in with `?deleted=<keptUntil>`, which the alert names. The
account-deleted email's link lands on `/restore` (no session, like `/undo`): it signs everyone out and
stops the password, and its answer says whether the code to choose a new one went — Enter the code
opens Forgot your password? on its code step for that address, or Forgot your password? asks for one.
A reset that brought a deleted account back says so in its toast (`restored`). The old address's
"Undo the change" lands on `/undo` and reads the same way (`UndoLinkView`, through `/api/auth/undo`): the
tap takes the account back to that address, signs everyone out and stops the password, and its answer
(`{ email, codeSent }`) leads to the code step or to Forgot your password? with the address. Both pages
share one component, since only their words and icon differ.

**Confirm your email to continue** (`/confirm-to-continue`, decision 17): an account from before email
past its deadline signs in as ever, with `emailConfirmationRequired`, and goes there instead of the app;
the app frame sends it there too whenever `/me` says so, and opens no mirror meanwhile, and any request
answered `403 EMAIL_CONFIRMATION_REQUIRED` has `/me` read again (`setConfirmationRequiredHandler`). The
step reuses the code form of the confirm sheet (`ConfirmEmailForm`), takes another address with the
current password, says how many changes this device keeps, and signs out with the "unsent changes"
question. The queue is held, not refused: `lib/local/README.md`.

The frame carries a language chip (F-02) and the register form a **Language** row; both open the same
sheet and both switch the screen's language, which _is_ the `locale` the account is created with —
there is no third value to keep in step. The switch carries the query string, so a `?reauth=1&next=…`
login does not lose its way back (§2.6). No "Follow device" here: that is a local mode of Settings,
not a value the contract takes.

A successful sign-in — a login, a restore or the code that creates an account — **ends "this device
only"** (P-36). The mode is a
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

**Cloudflare's check** (`lib/captcha`) runs unseen when Create account, Send code or Resend is pressed, and only shows
its box when Cloudflare has doubts. Its script loads the first time one of those screens opens, never
in the bundle. The flow exists only where `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set: without a key
there is no captcha, the backend refuses to send, and Sign in keeps the link inactive.

**Confirming the email** (T-210): only an account from before email can be unconfirmed (T-239). While it
is, the app frame paints the amber `verify` stripe, last in the order of the sync stripes, with the
deadline (`confirmBy`) once the account has one, and Settings › Password & email says it too. Confirm
opens one sheet (`ConfirmEmailSheet`, mounted by the frame and opened from anywhere through
`lib/session/confirm-email`), which asks `/me` again and opens on the code when one is live or on Send
code when none is; both sends carry Cloudflare's check. Sign up sends a `register` token; the backend
creates no account without one, so with no site key Sign up says it cannot create an account there and
keeps its button off (T-230). `/verify` does nothing until its one button is tapped, like `/reset`, and
its answer says whether it finished a sign-up (Sign in follows: the link proved the inbox, not the
password) or confirmed an account from before email. A dead link from a deadline email is told apart
by its token's length; the other two look the same, so the page offers both ways on. Nothing else
waits for the confirmation until the deadline: only invitations.

**A new email** (T-222) waits for its own code: Profile & security asks for it (`lib/session/email-change`,
`/api/auth/change-email`) and the account keeps its address until the new one answers. The same sheet
confirms it, opened by the card's Enter code (`openConfirmNewEmail`): the code keeps this device signed in
with a new session and signs every other one out. The email's link lands on `/confirm-email`, which does
nothing until its button, like `/verify`; it keeps this browser's session only when it was the account's.
The sheet ends, with its code gone, when the address became another account's meanwhile or nothing waits
any more.
