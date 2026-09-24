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

**What has not reached the server** says so with the two marks the rest of the app uses. `pending.ts`
reads the queue against the section and answers which rows **are** a queued write — they carry
`SyncBadge` and "Saved on this device" — and which figures **include** one, which carry `Projected`.
A write marks what it touches and nothing else: a payment marks its person and every group shared with
them, because it covers the oldest line first across all of them; an expense or a change to a group
marks that group and everybody in it, and those people in every other group too, since a new share
changes which lines their payments cover first; a person added or renamed marks only their own row. `Owed to
you` and `You owe` are marked together whenever anything is. A payment undone on this device is no
longer in the section, so the mirror's read hands back the undone ones (`undone`) and the queue's id
finds its person there.

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

**Three ways into a group's expenses, and one of them is the transaction form.** The picker lists the
movements that are not in a group yet; under it, `Record a new expense` leaves for
`/transactions/new?group=<id>`, where the form knows the group, drops the type control — only an
expense is shared in v1 — and on save writes **two** things: the movement, and the group's expense on
top of it with the split inherited. The movement goes **first**, because it is the money and it is
true whatever the group answers; when the group refuses, the screen says which half landed and retries
only the other. With no network both are queued and the expense **waits for the movement it names**,
the way it already waits for the group it is posted under.

**The third way in writes nothing of yours.** `PaidByOtherSheet` records a line another participant
paid: description, date, amount and who paid it, with the group's split inherited and no body carrying
one. It is not the transaction form and must not become it — no money of yours moved, so there is no
account, no category and no budget to ask about — and `expensePaidByOther` (`write.ts`) mints the row
with no `transactionId`, so the queued expense waits only for the group it is posted under. The payer
is one of the **other** participants, never you, and the list is **all of them or none**: a group whose
only participant is you, or one whose contacts have not all landed on this device, does not offer the
door at all rather than opening a picker missing somebody. The odd unit goes to whoever paid, which
here is not you.

**A group is not closed when it is created.** `AddPeopleSheet` is the contact picker with the question
that comes with it — _are they in the expenses already recorded?_ — and, when the answer is yes, the
whole result before it happens: the server answers each new share
(`POST /shared-groups/{id}/participants/preview`) and the device puts beside it what each person has
paid, who ends up **ahead of what they owe** and what a **written-off** amount becomes, which the
preview does not carry — `participants.ts` is that arithmetic, pure and tested on its own. **Applying
it needs a connection**: the re-split is the server's, and a second
arithmetic for it here would be one more thing to keep in step. Adding people without applying, editing
the group and taking somebody out all work with no network. **Taking somebody out is the same door**,
and it is offered only while they have no share and nothing paid.

**One control for a default split.** `DefaultSplitFields` is `Equal` and `Percent` and the percentages
they imply — the two modes that mean something without a total — and the new-group form, the edit sheet
and `Add people` in a percentage group all render that one, not three.

**A payment is undone, never balanced with a second one.** `settlement:delete` is the ninth outbox
action of the section: the mirror tombstones the payment and the movements it wrote, and the derivation
does the rest — what counts as yours goes back up on the expenses it had lowered, and everything else
that person has paid is imputed again over what is still open. `PaymentRows` is the one list and
`UndoPaymentSheet` the one sheet, opened from the three places a payment is read: a person's
`Payments`, the movement's own detail — which already said its money belonged to the payment and now
offers the door it was naming — and, for a **block of guests**, the shared card of the expense it lives
in, which is the only place a block is read at all.

**Giving up moves no figure.** A write-off stores the decision and the ceiling that was open when it
was taken; archiving a group writes off what is still owed on your behalf. Neither touches a figure of
yours: that money was counted as yours from the day it left the account.

**Letting somebody in is an invitation, and every write of one needs a connection.** An invitation is
addressed to the email of a contact who is in the group; nothing is emailed, and it waits in the other
person's Shared for 30 days. The feed brings both sides — `invitationsSent` and `invitationsReceived`,
two stores of the mirror with no outbox route — so they are **seen** offline; inviting, withdrawing,
stopping sharing and answering go straight to the server (`api.ts`) and keep its answer in the mirror
(`keepSentInvitation`, `keepReceivedInvitation`) so the screen does not wait for the next pull. Each is
about somebody else, and only the server can say whether the invitation still stands.
`InvitationsBlock` sits above both faces and above the empty state; an answer given during the visit
keeps its row, saying how it ended, until Shared opens again. `InviteSheet` is the group's door:
`invitations.ts` reads where each person stands from the newest invitation they have — no email, not
invited, waiting, out of time, joined or declined — and **never** tells a waiting invitation to an
address with an account from one without, because the server never says. An invitation past its date
is still `PENDING` on the server and is read against the server's clock (`isAnswerable`). The count on
More, on the bar and in the sidebar is the invitations that can still be answered.

**A group somebody shared with you is read, not worked.** Only its owner writes in it (v1), so it has
no outbox route: the feed brings it as `joinedGroups` and `joinedExpenses`, the mirror keeps it, and
`useJoinedGroups` derives each one's standing with `deriveJoined` (`lib/local/derive`) from the owner's
own `collected` figures. It sits under `Shared with you` in the groups face, archived ones fold with
the settled, what you owe there counts in `You owe`, and the People face closes the arithmetic with one
line per person who shared something. `/shared/joined/[id]` leads with where you stand with the owner.
**`Add to my ledger`** is offered only on a line the owner marked paid for you: it writes one ordinary
expense of yours per line, dated that line, in your account and category, and needs a connection.
It moves that account's stamp, so it moves the guards the queue holds on it and pulls the new balance
(T-146).
**`Leave this group`** ends your invitation, drops the group from the device, and moves no money.

The screens that compose other features — the group detail, the person, the settle-up sheet, the
transaction picker and the sheet that says what adding them changes — live in the **app layer**, like
the account detail does, because a feature never imports another feature.

A person is **not an account** — no balance of their own, never in the account picker, in a transfer
or in `Stats groupBy=account` — and their screen says so in one line, because that is the whole
reason a contact is an entity of its own.
