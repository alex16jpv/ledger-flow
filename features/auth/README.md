# Auth

Login, registration (with the Ley 1581 consent and detected currency/time zone) and the access
frame. Talks only to the session BFF (`/api/auth/*`); tokens never reach this code.

The frame carries a language chip (F-02) and the register form a **Language** row; both open the same
sheet and both switch the screen's language, which _is_ the `locale` the account is created with —
there is no third value to keep in step. The switch carries the query string, so a `?reauth=1&next=…`
login does not lose its way back (§2.6). No "Follow device" here: that is a local mode of Settings,
not a value the contract takes.
