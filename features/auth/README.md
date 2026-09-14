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
