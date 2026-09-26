# Shared

`preview/shared.html`

Expenses split with other people, and who has paid you back. This file is the specification of the
section: from here on it is what the product means by a **Shared group**, a **person** and a **split**,
and every other screen that shows a shared expense defers to it.

## The rule everything here obeys

> **What counts as yours is the money that left your accounts minus the money that came back.**
> Always, and per person.

Four consequences, and none of them is a screen's to bend:

1. **A shared expense is born entirely yours.** Splitting it lowers nothing: lowering it would be
   counting on money you have not received.
2. **Each payment lowers it in the month the expense happened**, not on the day of the payment. A
   month you had already closed can therefore change, which is why every change is kept (see
   [transactions.md](transactions.md)).
3. **Writing something off moves no figure.** It was already counted as yours from the day you paid
   it. It is a decision and a line of history.
4. **A line somebody else paid is not your expense until you pay them.** When you do, your expense is
   created with that line's **description and date**, so it lands in the month the money was spent —
   the mirror image of consequence 2 — and with **a category you choose**, because the shared layer
   carries none: categories are private and never travel.

Three figures live side by side, and the section is careful never to confuse them:

| Figure              | What it is                                                           | Where it leads                                                               |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Total**           | What the expense cost, and what left the account                     | The amount on a Transactions row                                             |
| **Counts as yours** | Total minus what has come back. **The figure Stats and Budgets use** | The lead figure of a group's detail and of the shared block in a transaction |
| **Your share**      | What the split says is fairly yours. A destination, not a fact       | The line under the total, everywhere                                         |

`Counts as yours` falls towards `your share` as people pay, and stops wherever the last write-off left
it. A group where nobody ever pays is a group whose figure never moves — which is exactly what should
happen, and it needs no machinery.

## Where it lives

`Shared` is in the **More** sheet on a phone and in the **sidebar** from 900px up, between Accounts and
Stats ([layout.md](../layout.md)). The bottom bar is full and is not touched.

## The section (`#people`, `#groups`)

One screen with two faces on a segmented control: **People** and **Shared groups**. People is the
default, because the question that brings anyone here is who owes whom, not which outing it was.

Above both, one card with **Owed to you** and **You owe** — the same two-figure shape as Accounts and
Home, and for the same reason (T-85): **there is no net figure**, here or anywhere else.

**People** lists the net per person across every group, in two sections, `Owes you` and `You owe`, with
the settled ones folded away. Each row: the person's initials in their colour, their name, the groups
they appear in, and the net.

**Colour is data, so the direction is a word.** These amounts are drawn neutral and unsigned. Green
would claim income and red would claim spending, and a debt between two people is neither; the row says
`owes you` or `you owe` under the figure instead. The same rule makes a collection neutral wherever it
appears.

A People row carries **no state badge**: `Paid` and the rest are facts about one group, and this row
crosses all of them. What it carries is the net and the word for its direction.

**Shared groups** lists the groups, newest first, each with its **date range**, how many people, what
it cost, your share of it, and a bar of **what has come back to you, of what people owe you net of
what you owe them** — the same quantity in every row. A group where nothing is owed to you has **no
bar at all**, only a badge saying what you owe: a bar that silently reverses direction is worse than
no bar. Settled groups fold away like archived accounts do, and **an archived group folds away with
them**, saying so on its row: it is the only way back into one, and there is no second fold for a
state that is already read as "nothing open here".

The row leads with what the outing **cost**, with your share underneath — the same shape as a
Transactions row, so the two lists read alike. The third figure, what still counts as yours, leads the
**detail**, which is where the history that explains it lives. That is the same division of labour the
Transactions row and its detail already make.

**Every list here pages from the first day**, and the one that gets long is the contact list: it says
how many it is showing of how many and offers `Load more` (`#pick-people`). A list that silently stops
is T-38, and this section is not allowed to repeat it. **The two limits — people in a group, contacts
in all — are said in the sheet that adds one**, never discovered by a save that fails.

## A shared group (`#group`)

**A group has no month.** Cartagena trip runs from August into September, and a two-month trip is one
group. The header carries the **range of its expenses**, and nothing on the screen may assume a period:
not the figures, not the list, not a filter.

The header leads with **what still counts as yours**, with the total and your share under it as
context, then the bar of what has been collected, then the one sentence that explains the gap — what is
still owed and what was written off. Then `Settle up` as the one primary action, and under it
`Add expense`, `Add people`, `Edit` and `Archive`.

**`Add expense` has three ways in and they are one sheet** (`#record-a-new-expense`). It opens the
list of your expenses that are not in a group yet, and under that list, `Record a new expense` and
`Somebody else paid` — the same place the contact sheet puts `New person`, and for the same reason: a
picker whose answer is not there yet offers to create it instead of sending you off to find it.
**The sheet is then called `Add expense`,
not `Pick from my transactions`**, for the reason the quick sheet stopped being called `Add expense`
when it grew the other two types: a title narrower than what the sheet does teaches the wrong thing.
Opened from the form that creates a group, where there is nothing to record into, it only picks and
says so. It leaves for the transaction form **knowing the group**, and what it records comes back
here. **An archived group offers none of the three**: it is
read, not worked. Leaving by a door that goes somewhere else leaves the sheet, so anything ticked in
the list is left with it — the three ways in are alternatives, and the one that navigates says so on
its face.

**Recording it from here writes both halves in one gesture**: the movement in your ledger — your
account, your category, your budget — and the group's expense on top of it, with the group's split
inherited without asking, exactly as picking one already does. What the form does while it belongs to a
group is in [add.md](add.md), and what it cannot do is make the expense somebody else's: a movement
recorded here is money that left **your** account, and a line another participant paid is not a
movement of yours at all. That one is the third door.

**`Somebody else paid` is that third door** (`#expense-somebody-else-paid`), and it is deliberately
not the transaction form: no money of yours moved, so there is no account, no category and no budget
to ask about, and a form that asked for them would be asking about a movement that does not exist.
The sheet asks for the four things such a line is — what it was, when, how much, and **who paid it** —
and inherits the group's split without asking, exactly as the other two doors do. It writes **one**
thing and not two: the group's expense, and nothing at all in your ledger. The sheet says so plainly,
and says when that stops being true: the day you settle with that person it becomes your expense,
dated that line and in a category you choose then (consequence 4).

**Who paid is one of the other participants, never you** (`#who-paid`) — picking yourself is what the
other two doors already are — so a group whose only participant is you has nobody to offer and does
not draw the door at all; `Add people` comes first. And the list is **all of them or none**: a device
that has not got every participant's name yet does not open a picker missing somebody, because the
name that is missing is the one you would have chosen, and choosing the wrong one moves money. And **a description is required here**, where the
transaction form lets it go: a movement with no description is named by its category on every list
that draws it, and this line has no category to borrow a name from — nor will the expense it turns
into the day you pay, which carries this description and nothing else.

**A group is not closed when it is created** (`#add-people`). `Add people` is the contact sheet the
form uses — the same search, the same paging, the same two limits said out loud, and the same
`New person`, because the commonest reason to add somebody afterwards is that they were not a contact
yet — plus the question that comes with it: **are they in the expenses already recorded?**

**In a group that splits by percentage the sheet asks for the new percentages**, because the old ones
no longer cover everybody and the server refuses the write without them — the same small control the
group's `Edit` uses, with what is left to assign under it.

**Putting them into what is already recorded needs a connection**, and with none the switch is off and
says so: the re-split is the server's, and the answer to what it would do is a question only it can
answer. Adding somebody **without** that, editing the group, taking somebody out and restoring one all
work with no network like every other write here.

Off — the default — they are in what you add from now on and in none of what is there. **On, the sheet
shows the whole result before it happens**, one row per person: the new share, who has paid what, who
is now **ahead of what they owe**, and what a **written-off** amount becomes — because a share that
falls takes the write-off down with it, and that is not a figure moving: nobody was ever owed the part
that is no longer theirs, and what counts as yours is the same before and after. Nothing collected is
undone.

It is **the whole group or none of it**. A two-month trip has expenses somebody who joined halfway was
not at, and the exact answer for those is the one the section already has: add them, then set that
expense's own split. One switch that quietly did it per expense would be guessing.

**Taking somebody out** is the same door and the narrow case: it is offered only while they have **no
share in any expense and nothing paid**. Once either exists, removing them would have to either delete
money that arrived or silently hand their share to everyone else, so the group offers what actually
applies instead — settle with them, or write off what they owe.

**People**, one row each, with the group's split named once above them **as its default** — it is a
link, and it opens the group's own `Edit`, where that default lives beside the name and the colour. **You are a row like everybody else**, with a
share of your own. Four states:

| State            | Where it comes from                                 |
| ---------------- | --------------------------------------------------- |
| `Not paid`       | Derived from the money: nothing received            |
| `Partially paid` | Derived: something received, not all                |
| `Paid`           | Derived: everything received                        |
| `Written off`    | **Stored**, because it is a decision, not an amount |

**And one reading that is not a state: somebody who has paid more than their share.** It happens the
moment a share falls under them — a person added to the group, an expense deleted, a split edited. The
row stays `Paid` and names the surplus, `Paid · $160,000 ahead`; on the **People** face that person
moves to **`You owe`**, because that is what it is: their money, in your account. Settling it is the
only movement in the section that leaves an account without being an expense — you never spent it, so
it carries no category and stays out of Stats and Budgets, exactly like the collection it reverses.

**Expenses**, one row each, with its date, who paid it and your share. **A line somebody else paid
says so, is drawn neutral and reads "not in your ledger"** (`#group-with-another-payer`): no movement
of yours exists for it, and it becomes your expense the day you settle with them. Where two people
paid, what you can collect from each is the **net** between the two of you, and the header says it in
a sentence rather than leaving it to be worked out.

## A person (`#person`)

One contact across every group: what they owe you or you owe them, the groups they appear in with their
state in each, and the payments already made. `Settle up` is the primary action, and **each payment in
that list opens the one thing that can be done to it: undoing it** (`#undo-a-payment`).

**A payment row says what a payment knows**: which way it went, **the net that changed hands** — one
payment can settle both directions at once, and a row has one figure — the day, and whether it was
cash the app never saw. It does not name an account or a group, and that is not an omission — a
payment carries neither. It **belongs to the person**, covering the oldest line first across every
group shared with them, and the account it touched belongs to the movement it wrote. That movement's
own row is where both are read ([transactions.md](transactions.md)).

**A person is not an account**, and this screen says so at the bottom in one line: a person has no
balance of their own and never appears among your accounts, in the account picker, in a transfer, in
`Stats groupBy=account` or inside what you have and what you owe. The money still moves in **your**
accounts — a collection arrives in one, paying somebody back leaves one — and that is the only place
it ever moves.

That is the whole reason the contact is an entity of its own. As an account, every one of those ten
surfaces would need an "except for people" exception, and the one that got forgotten would teach a
person as if they were a bank or add their debt to your net worth. A person has no type, no limit, no
available balance and no `Pay this card`.

A contact is **archived, never deleted**, its name is unique per user like an account's, and its
**email is what an invitation is addressed to** (`#invite`) — nothing is emailed, and the sheet that
asks for it says exactly that rather than leaving the field to be guessed at (`#new-person`).

## Creating a group (`#new-group`, `#pick-transactions`)

The flow is built around the habit it serves: **the expenses already exist**. They were recorded with
the Quick add during the night, and the group is assembled the next morning. So the form takes a name,
a colour, who was in, **a default split chosen once**, and then picks the expenses from the
transactions that are already there — over the group's own range, any account, with a checkbox on the
same row the list already draws.

**This form does not record a new one**, and that is the habit above rather than an omission: it
assembles a group out of expenses that are already in your ledger. Recording one that is not there yet
is offered **from the group**, one screen later, where there is already something for it to belong to —
a way in here would either lose the half-typed form on the way to the transaction form or create the
group behind your back, from a button under a field. (Owner's decision, 2026-09-21.)

**The group's split is a default, not a rule** (`#split-one-expense`). A new expense inherits it
without asking, and **any expense can carry its own** in any of the four modes: a trip that splits
equally can have one dinner by exact amounts. An expense that went its own way reads **`Custom split`**
in the group's list, so the exceptions are visible without opening them, and the sheet says plainly
what it touches — this expense, and nothing else, with its own figures named.

**The group's default is only `Equal` or `Percent`.** A default has no total to divide, so `Exact` and
`Fixed + rest` are things only an expense can have; offering them where they cannot mean anything is
the contradiction T-86 had to undo elsewhere. The group's control is the two that work without a
total, and it is not the expense's sheet with the rows removed — it is a smaller control, and the spec
does not pretend otherwise.

**Changing the default never goes back.** It applies to the expenses you add from now on, and to
nothing already recorded. The alternative — re-splitting every untouched expense — would re-impute
every payment and move what counts as yours between months, closed ones included, behind a segmented
control. When that is what somebody wants, the deliberate version of it is `Add people`, which asks
first and shows the whole result.

**The `Custom split` flag is set** when you save a split on that expense and **cleared** by
`Use the group's split`, which the same sheet offers; the expense then follows the default again, from
that moment on.

**`Split this`** on a single transaction is the same thing seen from the other end: it creates a group
of one expense, named after it. There is one concept, not two — an expense is split because it belongs
to a group, even a group of one.

### What adding them changes (`#what-changes-in-budgets`)

This has to be said **before** saving, and the surprising part is that **nothing changes today**. The
money left the account, so the expenses keep counting in full until somebody pays. The sheet names the
expenses, their categories and their months, and then says the part that matters: when someone pays,
the figure falls **in the month the expense happened**, so a closed month can change — and every change
is kept in that expense's history.

## Splitting (`#split-equal`, `#split-fixed`)

One sheet, four modes on a segmented control:

| Mode             | What you type                                                                   |
| ---------------- | ------------------------------------------------------------------------------- |
| **Equal**        | Nothing. Everyone the same                                                      |
| **Percent**      | A percentage each; the sheet shows the money                                    |
| **Exact**        | An amount each                                                                  |
| **Fixed + rest** | An amount for the people you pin, and the rest splits itself between the others |

`Fixed + rest` is the owner's case, in his words: "pepito only pays 50". A pinned person keeps their
figure and the remainder redistributes itself the moment it changes. Shares ("Ana pays 2") are not in
v1.

### Guests, on one expense (`#split-with-guests`)

A night out of three that, for one expense, was twenty-three people. **The group stays the size it
is**: the guests belong to **that expense alone**.

**The head count sits above the rows**, next to the mode, because it governs every one of them: it
reads `3 people + 20 guests = 23 shares`. The block is then **one ordinary money row** like anybody
else. Putting the count in the amount column would make it the only control in the sheet whose number
is not money, and would leave `Percent` and `Exact` ambiguous; above the rows, all four modes fall out
unchanged — by heads under `Equal`, by a figure you type under the others.

They count as **as many shares as there are of them** and as **one party to collect from**. $230,000
between three friends and twenty guests is 23 shares of $10,000: $30,000 between the three, $200,000
for the block. You can record what the block pays, in full or in part, and you cannot say who inside
it paid what — the control you give up for a trail you would otherwise not have at all. **The count
starts at one**: one guest is the same control, and the block can carry a name if it deserves one.

**The odd peso follows the same rule** it follows for people: it goes to whoever paid, never to the
block, so the shares add up to the expense with guests exactly as without them. A block is written off
and archived like anybody else.

Once the expense is saved the block is **somebody to collect from**: it appears in that expense's
shared card with its own state, and in the group's People section **under the expense's name**. Its
four states are everybody else's, `Written off` included.

**It counts in every figure that is about what is owed to you**, because it is: the group's bar
includes it, and so does `Owed to you` at the top of the section. What it is not is a row on the
**People** face, which lists people; there, when blocks exist, one line closes the arithmetic —
"$200,000 more from guests, in 1 shared group" — so the rows and the total never disagree. A block
with nothing outstanding is not mentioned at all.

Guests are **not contacts**: they never reach People — the section — they cannot be reused on another
expense, and they go when the expense goes. Somebody you want real control over is added to the group
instead. The row works in all four modes — by heads under `Equal`, by a figure you type under the
others.

Under the rows, **what is left to assign**, always visible, and the sheet cannot be saved while it is
not zero. The shares always add up to the expense, guests included.

**The odd peso goes to whoever paid**, and the sheet says so in words. $100,000 does not divide by
three and the Colombian peso has no cents (T-67), so the remainder has to land somewhere chosen rather
than somewhere accidental. This is not decoration: the server and the offline projection have to
produce the same shares to the peso, or a difference appears that nobody can explain — which is what
the parity fixtures in `lib/local/derive` exist to prevent.

## Getting paid, and paying (`#settle-up`, `#settle-up-both-ways`, `#record-a-payment`, `#pay-somebody-back`)

**One sheet**, `Settle up`, reached from a person's row, from a group, or from a shared expense.
`Mark as paid` and `Record a payment` are the same sheet with the amount prefilled full or left to
type. It settles **everything open between you and one counterparty**, and it says what it covers.

**A door that reaches more than one counterparty asks who first** (`#settle-up-who`): the group's own
`Settle up`, and a shared expense's, list everybody with something open — their name and the net, with
the word for its direction — and open the sheet on the one that is picked. A row that reaches exactly
one person opens the sheet straight away, because a list of one is a question with one answer.

A counterparty is **a person or a guest block**. For a person that means every group; for a block it
means the one expense it lives in, which is all there is — a block has no other expense to net
against, no email and no cross-group history, and the sheet simply shows less rather than pretending
otherwise.

- **Money coming back is not income.** It arrives in an account, carries no category, and is excluded
  from Stats and from Budgets — the shape `ADJUSTMENT` already has. It is drawn neutral, never green.
- **What a payment covers is imputed oldest expense first.** That is why somebody can read
  `Partially paid` in a group and `Paid` on its first expense, and the sheet lists what it covers so
  the rule is visible rather than inferred. **A payment belongs to the person, not to the expense it
  landed on**: deleting an expense, or editing its split, re-imputes every payment over what is left,
  and each expense it touches says so in its history. Nothing about a payment is ever undone by
  editing an expense — that is what makes the rule safe to store.
- **A payment can be outside the app** — cash that never reached an account kept here. Then **no
  movement is created and no balance changes**, and the sheet says that plainly; the expenses still
  fall, because that money did come back. It is the one place where what counts as yours moves without
  an account moving, and it moves because the user said the money arrived.
- **Paying somebody back is not a payment at all, from your ledger's side** (`#pay-somebody-back`):
  it is **your expense**, one per line you are covering, each with that line's description and
  **dated that line**, so it lands in the month the money was spent. **The sheet asks for the
  category**, because the shared group carries none — categories are private, they never travel, and
  the other person's are theirs. One picker fills them all and can be changed per line. Writing one
  lump expense instead would be less typing and a worse figure: the owner asked for the categories to
  come out exact, and this is where that is won or lost.
- **When you owe them too, one payment writes both halves** (`#settle-up-both-ways`). Ana paid for the
  tickets and you paid for the rest, so the sheet shows the two directions and the net she actually
  sends, and then says what it will record: the collection arriving, **and** your share of her line as
  an expense dated the day of that line, in the category the sheet asks for. The balance moves by the
  net. Splitting it into two movements is what keeps the categories exact; a single net movement would
  leave your share of the tickets counted nowhere. **A smaller amount than the net covers what she
  owes you first**, oldest expense first, and what you owe her is recorded only once that is square —
  so a partial payment never leaves you with an expense you have not paid for.

### Undoing a payment (`#undo-a-payment`)

**A payment recorded by mistake is undone, never balanced with a second one.** A payment in the other
direction is a real event — money moving — and using it to correct a typo would leave two movements
that never happened and a trail nobody can read. So the payment goes, and with it everything it wrote.

**The doors are the places a payment is looked at from.** The `Payments` list on a person
(`#person`); **the movement's own detail**, because that movement says it belongs to a payment and
cannot be edited or deleted on its own ([transactions.md](transactions.md)), so that is exactly where
somebody who found it in Transactions will ask; and, for **a block of guests**, the shared card of the
expense it lives in — a block is not a person and has no page, so its expense is the only place it is
read. One sheet, reached from any of them. While the payment is
still being read the door **says so** rather than going missing and coming back.

**The sheet says what goes and what stays**, because undoing reaches further than the row it is opened
from:

- **What it gives back:** the amount goes back to being owed, in the direction it was paid, and **a
  full settle-up carries both directions**, so the sheet names both and its button names neither. A
  destructive confirmation that named one half of what it is about to put back would be a message that
  lies. It is not a refund and no new movement is written — what was recorded stops having happened.
- **What goes with it:** the movement it wrote, whichever shape it had — the collection that arrived,
  the expense per line of paying somebody back, the refund that left. They are its money and they go
  when it goes. **A payment made in cash outside the app wrote none**, so nothing moves in any account
  and the sheet says that instead.
- **What moves:** what counts as yours goes **back up** on the expenses it had lowered, each in the
  month that expense happened — the mirror of a payment, and for the same reason a closed month can
  change — and each one keeps the change in its history.
- **What does not move:** no expense leaves a group, nobody leaves a group, and **a write-off stays a
  write-off**. Undoing a payment is about one payment.
- **What is worked out again:** everything else that person has paid is imputed again over the lines
  still open, oldest first. That is the same rule as ever — a payment belongs to the person, not to
  the expense it landed on — and it is why this is safe to offer rather than something to be afraid
  of.

**A payment made from a loan paid off since cannot be undone** (T-156): giving that money back would
leave the loan above zero. The sheet closes and the `danger` toast of the movement's detail says what
to do first — lower the loan's payment — ([transactions.md](transactions.md)); nothing is undone.

The confirmation is the destructive one the section already uses for `Write off` and `Archive`, and it
names the amount. **Undoing is not itself undoable**: what comes back is the debt, and recording the
payment again is the way back — the sheet does not pretend otherwise.

## Writing off, and archiving (`#write-off`, `#archive-with-people-owing`)

**`Write off`** is reached from the settle-up sheet of the person who owes it — the other answer to
the same row — and **taking it back is the row itself** (`#undo-write-off`): somebody who reads
`Written off` opens a confirmation saying what they owe again and that no figure of yours moves either
way, which is true in both directions.

**`Write off`** answers the owner's worry, and the answer is that there is nothing to do: no figure
changes, because the money was counted as his from the day he paid it. The sheet says exactly that.
It writes off **what is still open**, so somebody who paid part of it keeps that part, and their row
becomes `Written off`. The sheet says what the group becomes: once nobody is left owing — by paying
or by being written off — the group is `Settled`. It can be undone until the group is archived.

**Archiving a group with people still owing writes those amounts off on your behalf**, so the
confirmation says what it will do and what it will not: the amount stays counted as yours, nothing is
deleted, and the group stays readable.

**An archived group is read, not worked** (`#archived`): its detail keeps every figure and its
history, says in one line what archiving did, and offers `Restore` in place of the actions — there is
nothing to settle, add, edit or archive in a group that is closed. Restoring does **not** take the
write-offs back: each one is a decision, and each is undone on its own once the group is open again.

## Invitations (`#invitations`, `#invite`)

**Letting somebody see a group is an invitation, addressed to the email of the person in it.** Nothing
is emailed — invitations are not among the emails the app sends — and the sheets say so: the invitation
waits in **their** Shared, and they find it the next time they open Ledger Flow with that address, once
it is confirmed. Each group is its own
invitation: somebody who joined one of your groups is asked again for the next one, and never appears
in a group they did not accept.

### Inviting (`#invite`, `#invite-waiting`, `#stop-sharing`)

The last row of a group's **People** is `Invite them to see this group`, with a line saying who already
does and who has not been invited. It opens one sheet with a row per person in the group — you are not
one of them — and where each stands:

| Where they stand     | The row says                                 | And offers     |
| -------------------- | -------------------------------------------- | -------------- |
| No email             | `No email yet`                               | `Add email`    |
| Not invited          | their email · `not invited`                  | `Invite`       |
| Waiting              | their email · invited when · open until when | `Withdraw`     |
| Joined               | `Joined` · since when                        | `Stop sharing` |
| Declined             | their email · `declined` · when              | `Invite again` |
| Left                 | their email · `left` · when                  | `Invite again` |
| Not answered in time | their email · `not answered in 30 days`      | `Invite again` |

The sheet says, before anything is sent, **what joining shows and what it never shows**: the group —
its expenses, who paid and how each one is split — and never your accounts, categories or notes (the
frontier every shared screen keeps). It also says the two limits: an invitation **waits 30 days**, and
up to **50** of yours can be waiting at once.

**You are never told whether an address has an account.** Right after `Invite` the sheet says it in so
many words: if that address has no account yet the invitation waits for it all the same, and the row
reads _waiting_ either way until they answer. Nothing on this screen — not an error, not a delay, not a
different word — may tell the two apart; that is what keeps the invitation from being a way to find out
who uses Ledger Flow.

**`Stop sharing`** is the way back from `Joined`, and it is a destructive confirmation that says what
it does not do: they stop seeing the group and **stay in it as a person you split with** — their
share, what they paid and what they owe do not move, nor does what counts as yours, and what they
already put into their own ledger stays theirs. Inviting them again is how they come back.

What ends a waiting invitation **without anybody answering**, all of them on the server:

- **Withdrawing it**, from the row.
- **Taking the person out of the group**, or archiving the contact — there is nobody left to invite.
- **Changing the contact's email** — it was addressed to the old one.
- **Archiving the group** — an archived group is read, not worked. Restoring it does not send them
  again.

Taking out a person who **joined**, or archiving their contact, ends their sharing the same way
`Stop sharing` does.

A rename or a new colour reaches a waiting invitation as it is: the person sees the group's name as it
is now.

### Being invited (`#invitations`, `#invitation-first`, `#invitation-answered`)

**Invitations sit above both faces of Shared**, headed `Invitations` with their count, so they are the
first thing the section says — and above the empty state too, because the commonest way anybody meets
Shared is that a friend invited them and they have nothing of their own yet (`#invitation-first`).

A row shows **the only two things an invitation may reveal: the name of the group and who sent it** —
the sender's name and email as they gave them to Ledger Flow, so the person can tell who it is — with
when it was sent and until when it is open. Nothing else about the group is shown before joining: not
its people, not its figures. The two answers are on the row, `Decline` (ghost) and `Accept`
(primary). The line under the block says what joining lets you see and that nothing of your own ledger
reaches anybody.

**Answered, the row says how it ended** — `Joined` (`success`) or `Declined` (neutral) — instead of
vanishing under the finger, and it leaves the next time Shared opens. The same happens when it was
answered on another device. **The person who invited learns the answer**: `Joined` or `declined` on
their row. Accepting puts the group among your **Shared groups**, under `Shared with you`
([Somebody else's group](#somebody-elses-group-shared-with-you-joined-group-add-to-my-ledger)), and
joining touches nothing in your ledger.

**An invitation stops being answerable** when it is withdrawn, when the group is archived, or when its
30 days pass. The row then goes from the block; answering one that stopped a moment ago on the server
answers `No longer available` on the row, and nothing else happens. The date is read against the
server's clock on both sides — the device corrects its own by what the server last told it — so a
phone set a day ahead does not hide an invitation that can still be answered.

### In another currency (`#invitation-other-currency`)

Each person keeps one currency, so **a group in another currency cannot be joined**: the row says so —
"this group is in EUR and your Ledger Flow is in COP, so it can't be joined" — and offers only
`Decline`. The person who invited is never told why: to them it reads _waiting_ until it is declined or
runs out, exactly as any other.

### How it is found (`#invitations-in-more`)

Not by chance, and without the notifications inbox, which does not exist yet: while an invitation can be
answered, **More carries the brand dot** (named "More, 1 invitation waiting"), the **Shared row inside
the sheet** says "1 invitation waiting for you" with the count beside it, and **from 900px the count
sits beside Shared in the sidebar**, read as "1 waiting". It is brand, like every sign of something
from somebody else, and never amber. The count is the invitations that can still be answered, and it
goes the moment the last one is. The day notifications exist, an invitation is also a notification,
and these three signs are theirs.

### With an email not confirmed (`#invite-needs-confirmed-email`, `#invitations-need-confirmed-email`)

**Sending, accepting and seeing new invitations wait for a confirmed email** (the owner's decision 3 of
2026-09-26): an invitation takes the sender's address to somebody else, and it finds the person by
theirs, so both have to be proven. Groups already joined are not touched. It ends the risk accepted on
2026-09-22, that whoever registered somebody else's address received what was sent to it.

- **Inviting:** the sheet opens with a `warning` alert, "**Confirm your email to invite people.** An
  invitation goes out with your address, so it has to be confirmed first. **Confirm email**", which
  opens the code sheet ([states.md](states.md)), and **Invite** and **Invite again** are disabled.
  **Withdraw** and **Stop sharing** are not: they only take something back.
- **Being invited:** the server only looks for invitations to a confirmed address, so none can show
  before — including one that was already seen before this rule existed: it waits, like every other,
  until the email is confirmed, and its 30 days keep running. While the email is not confirmed, the invitations' place carries a `neutral` alert,
  "Invitations to you show up here once you confirm your email. **Confirm it**". A
  `403 EMAIL_NOT_VERIFIED` that arrives anyway — the email changed on another device — shows the same.

### Offline (`#invitations-offline`)

Invitations come down with everything else, so they are **seen** offline. **Answering needs a
connection**: the answer goes to somebody else, and only the server can say whether the invitation
still stands — withdrawn, archived or out of time — so the two buttons are disabled and one line says
why. **Inviting, withdrawing and `Stop sharing` need one too**, for the same reason seen from the other
side, and the sheet says so the same way.

**The person who invited sees the answer the next time their app catches up**, like everything else
that arrives from the server.

## Somebody else's group (`#shared-with-you`, `#joined-group`, `#add-to-my-ledger`)

**The shared layer arrives whole, and nothing of anybody's ledger arrives with it.** Somebody who
joined sees the group, its people, its expenses, who paid each one, how each one is split and where
everybody stands. They never see the owner's accounts, categories or notes, what counts as the owner's,
or which movement an expense is. That is the frontier every shared screen keeps, seen from the other
side.

**Only the person who shared it writes in it.** It is v1's rule, and the owner has said it changes soon.
So a group shared with you is **read, not worked**, like an archived one, for a different reason: no
`Settle up`, no `Add expense`, no `Add people`, no `Edit`, no `Archive`. Its one line says so: "Shared by
Ana Ruiz · only she can change it".

### Where it is (`#shared-with-you`)

In **Shared groups**, under your own, a section **`Shared with you`**, one row per group. Each row has
the name, `Shared by Ana Ruiz`, the range, how many people, what it cost and your share, and a badge
saying where you stand with the person who shared it. That is one of the four states, because that
is what the group keeps.

**What you owe there is real, so it counts in `You owe`** at the top of the section. It is information,
not spending, because none of it is in your ledger until you pay. The **People** face lists your
contacts, and the owner is not one of them, so one line closes the arithmetic, exactly as guest blocks
do: "$80,000 more to Ana Ruiz, in 1 group shared with you". When everything you have here was shared
with you, Shared opens on `Shared groups`.

### The group (`#joined-group`)

The header leads with **where you stand with the person who shared it**: `You owe Ana $80,000`,
`Ana owes you $40,000` or `Square with Ana`. It is drawn neutral, with a word for the direction, like
every debt between people. Under it, as context, come the total and your share, and the bar of what you
have paid of what you owe her. **`Counts as yours` does not lead here**: nothing of this group is in your
ledger until you add it, and what you add is an ordinary expense of yours.

**People**, one row each, named by decision 28: **the owner and anybody who joined go by the name on
their own profile**; anybody who has not joined goes by the name the owner gave them, the only name the
group has for them; and you are `You`. Each row has its share and its state, which is always about
the owner, because that is the only debt the group keeps.

**Expenses**, one row each, with its date, who paid and your share. A line **the owner paid** also
says where your part of it stands:

| Your part      | The row says                              | And offers                       |
| -------------- | ----------------------------------------- | -------------------------------- |
| Not paid       | `Not paid`                                | Nothing yet                      |
| Paid           | `Paid`                                    | `Add to my ledger`               |
| In your ledger | `In your ledger` · its category · account | Opens that movement              |
| Written off    | `Written off`                             | Nothing: no money of yours moved |

**A line somebody else paid** reads "Marta paid · between you and Marta". The group keeps what each
person owes the one who shared it, and what you owe Marta is for the two of you to settle, in v1.
**A line you paid** reads "you paid": that money left your account, so it is in your ledger if you
recorded it, and nothing here adds it for you.

### Add to my ledger (`#add-to-my-ledger`)

**It is offered only on a line the owner has marked paid for you** (the owner's decision 25). She
records the money arriving in her account, and you record it leaving yours: they are two sides of
one payment. So nothing reaches your ledger before your money moved, and nothing reaches it twice.

**One sheet** covers every line that is ready. The group's primary action says how many,
`Add to my ledger · 2 ready`, and a single line opens the same sheet with that line only. It asks for
the **account** the money left from and the **category**: one picker fills them all and can be
changed per line, the same control as paying somebody back, and for the same reason. The group
carries no categories, and the owner's are hers. It writes **one ordinary expense per line**: your
share, **dated that line** and with its description. So it lands in the month the money was spent,
and the sheet says that a month you already closed can change.

**Added, the line reads `In your ledger`** and cannot be added again, on this device or any other. The
movement is yours like any other: edit it, move it or delete it, and deleting it makes the line ready
again. Its detail says where it came from: "Added from Villa de Leyva weekend, shared by Ana Ruiz".

**Your ledger is yours, and nobody else writes in it.** If the owner later undoes that payment or
changes the line, your movement stays as it is, and the line says what no longer matches:
"In your ledger for $60,000 · your part is now $75,000", or "Ana no longer has it marked paid". You
decide what to do with the movement.

**It needs a connection.** Whether the line is still paid and still shared with you is the server's to
say, so offline the button is disabled and one line says why, the same way answering an invitation
is.

### Archived (`#joined-archived`)

**A group the owner archives stays with you** (decision 26). It is still read-only and folds away with
the settled ones, and its one line says "Ana archived this group". `Add to my ledger` still works on
its paid lines, because it writes nothing in the group, only in your ledger, and that money did move.
What you already added stays yours.

### Leaving (`#leave-group`)

**`Leave this group`** is at the foot of the group, under the expenses (decision 27). It is `Stop sharing` seen from your
side, and its confirmation says what it does not do. You stop seeing the group, and you **stay in it
as somebody Ana splits with**: your share, what you paid and what you owe do not move, and what you
added to your ledger stays yours. Ana's row for you reads `left`, and inviting you again is how you
come back. It needs a connection, like every invitation write.

**The group also leaves your Shared** when the owner stops sharing, takes you out of it, archives your
contact or deletes her account. It leaves the next time your app catches up, with nothing of yours
touched. Archiving does not end it.

## The four states

- **Data** — the plates above.
- **Empty** (`#empty`) — one sentence explaining what a shared group is, and the two ways in. With
  nothing at all the two faces are not drawn: there is nothing to switch between, and a segmented
  control over two empty lists is a control that does nothing.
- **Loading** (`#loading`) — the list skeleton of [states.md](states.md), with the two summary figures
  as skeletons too: they are the part somebody came to read.
- **Error** (`#error`) — the screen's error with its reference, and, offline with no local copy, the
  honest empty state Transactions uses.

`Percent` (`#split-percent`) and `Exact` (`#split-one-expense`) are the same sheet with a different
unit, and what is left to assign is what says the figures do not add up yet.

Offline, everything in this section is projected from the local mirror like every other figure, and
what has not reached the server says so (`#pending-people`, below). A group is yours alone until
somebody accepts an invitation to it (`#invitations`).

## What has not reached the server (`#pending-people`, `#pending-groups`, `#pending-group`, `#pending-person`)

Every write in this section works with no network and waits in the queue like any other, so the
section uses the two marks the rest of the app already uses, and no third one:

- **A row that is itself the write** carries the `warning` badge **`Pending sync`** (`cloud-off`) and
  the metadata **`Saved on this device`**, exactly like a Transactions row; when its operation is in
  conflict or was refused, the badge is `danger` **`Needs attention`**. Those rows are an expense in a
  group's list, a payment on a person, a group on the `Shared groups` face when the group itself was
  created or changed here, and a person on the `People` face when the contact was.
- **A figure that includes a write** carries the projection mark (component 24), and only that figure:
  a queued write marks **what it touches and nothing else** (owner's decision, 2026-09-23). A section
  where one payment clouds every figure teaches that the mark means nothing.

What each write touches:

| Waiting in the queue                                                                                             | Marks                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A payment with somebody**, or undoing one                                                                      | That person: their net on `People`, the lead figure of their screen, their row in **every** group shared with them — a payment covers the oldest line first, across all of them — and those groups' figures                                            |
| **An expense** added, recorded or re-split                                                                       | Its group: the group's row, its header and the figure of everybody in it. And **everybody in it, everywhere**: a new or re-split share changes which of their lines their payments cover first, so their nets and every group they are in move with it |
| **A change to the group itself** — created, edited, people added or taken out, a write-off, archived or restored | The same as an expense                                                                                                                                                                                                                                 |
| **A movement in a group** whose amount, date or description was edited, or that was deleted                      | The same as an expense: the server writes the movement's expense in the same request, so the expense's row carries the badge, or its group's figures the mark once it has left the list                                                                |
| **A person** added or edited                                                                                     | Their row's badge only: no money moved, so no figure is marked                                                                                                                                                                                         |

**`Owed to you` and `You owe` are marked together** whenever anything in the section is marked: both
add up everybody, and a payment that settles somebody takes them out of one without putting them in the
other, so neither can be cleared on its own; the same goes for the total over each list on `People`. The
line that closes the arithmetic for guests is marked when a block it counts is touched — a payment from
that block, or a write to its group — and not for a payment from a person in the same group, because a
block's payments are its own. **The shared card of a transaction** follows its group: its lead figure
when the group is marked or when the movement itself was edited here, and each person's row when that
person's figure is ([transactions.md](transactions.md)).

**One mark per figure a row or a header leads with** — its amount, and its bar when it has one. The
smaller figures under them — `Your share` under a group's cost, the sentence under a group's header, the
share under a person's paid amount — are read under that mark rather than carrying one each: a row with
four clouds is a row nobody reads.

Somebody who joined a group has neither mark, because nothing they do is written without a connection:
`Add to my ledger`, answering an invitation and leaving a group all wait for one (`#invitations-offline`, `#add-to-my-ledger`).

## What this section is not, in v1

Sharing an income or a transfer, more than one currency inside a group, and weights expressed as shares
are all out. So is **anybody but the owner writing in a group**: somebody who joined reads it and takes
their part into their own ledger, and the owner has said this changes soon — nothing above assumes it
never will.
