# Shared

Expenses split with other people, and who has paid you back: the two faces of the section
(`People` and `Shared groups`), a group, a person, and the people themselves. What the product means
by a shared group, a person and a split is `design/spec/screens/shared.md`; this file is how it is
read and written here.

**One read for the whole section.** A payment is imputed **per counterparty across every group**, so
no figure here can be worked out from one group alone: `readSharedLedger()` brings every group, every
live expense and every live payment in one query, and `ledger.ts` turns them into what a screen draws
with `deriveShared` (`lib/local/derive`), the same arithmetic the parity fixtures hold against the
server. `sectionOf` is pure and tested on its own: the net per person, a group's people with their
state, what still counts as yours, and the bar of what has come back of everything that was ever owed
to you. Guest blocks are parties to collect from but never rows on `People`; one line closes the
arithmetic there instead. See `DECISIONS.md` (T-121) for why this is one read and not one list per
screen.

**Three figures, never confused.** The list row leads with what the outing **cost** and says your
share underneath; the detail leads with **what still counts as yours** — what left your accounts
less what has come back — with the total and your share as context. A line somebody else paid is not
a movement of yours: it is drawn neutral and says so, and it becomes your expense the day you settle
with them.

**Colour is data**, so a debt between two people is drawn neutral and unsigned and the direction is a
word: `owes you` or `you owe` under the figure. Green would claim income and red would claim
spending, and this is neither.

Reads go through `lib/local/repository`, so the section answers from the mirror whenever a pull has
drained, network or not, and reaches the server only where the mirror cannot answer — a device with
no copy yet. Writes go through `lib/local/outbox`: `contact` is an entity of the queue like an
account or a category, so a person can be added, renamed or archived with no network. A person is
**archived, never deleted**: the groups and the payments that name them stay readable.

**Splitting.** `split.ts` is the sheet's model — the four modes, the block of guests, what is left to
assign — and it resolves through `resolveShares` (`lib/local/derive`), the same arithmetic the server
runs, so a split made with no network agrees with it to the minor unit. `write.ts` turns a group's
default into what a new expense inherits. An expense that inherits **sends no split**: the server
resolves the default itself, and carrying one is exactly what sets `customSplit`. `Split this` on a
loose movement creates a shared group of one, because there is one concept and not two.

**Settling up.** `settle.ts` is the sheet's model: what one counterparty owes you, what you owe them,
the open lines in both directions, and what a given amount covers — imputed **oldest expense first**
with `impute` (`lib/local/derive`), which is the server's own rule. The sheet asks for **what changes
hands**, and both halves are recorded only once that squares it: a smaller amount covers what they owe
you first, and what you owe them is recorded only when that is square. Paying somebody back is not a
payment from your ledger's side — it is **one expense of yours per line**, dated that line and in a
category the sheet asks for, because the shared layer carries none. A payment can be **outside the
app**, and then no movement is written and no balance moves, while the expenses still fall.

**Giving up moves no figure.** A write-off stores the decision and the ceiling that was open when it
was taken; archiving a group writes off what is still owed on your behalf. Neither touches a figure of
yours: that money was counted as yours from the day it left the account.

The screens that compose other features — the group detail, the person, the settle-up sheet, the
transaction picker and the sheet that says what adding them changes — live in the **app layer**, like
the account detail does, because a feature never imports another feature.

A person is **not an account** — no balance of their own, never in the account picker, in a transfer
or in `Stats groupBy=account` — and their screen says so in one line, because that is the whole
reason a contact is an entity of its own.
