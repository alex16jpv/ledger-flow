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
   created with that line's category **and that line's date**, so it lands in the month the money was
   spent — the mirror image of consequence 2.

Three figures live side by side, and the section is careful never to confuse them:

| Figure              | What it is                                                           | Where it leads                                                      |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Total**           | What the expense cost, and what left the account                     | The amount on a Transactions row                                    |
| **Counts as yours** | Total minus what has come back. **The figure Stats and Budgets use** | The lead figure of a group and of the shared block in a transaction |
| **Your share**      | What the split says is fairly yours. A destination, not a fact       | The line under the total, everywhere                                |

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
they appear in, their state and the amount.

**Colour is data, so the direction is a word.** These amounts are drawn neutral and unsigned. Green
would claim income and red would claim spending, and a debt between two people is neither; the row says
`owes you` or `you owe` under the figure instead. The same rule makes a collection neutral wherever it
appears.

**Shared groups** lists the groups, newest first, each with its **date range**, how many people, what it
cost, your share of it, and a bar of what has come back to you. Settled groups fold away like archived
accounts do.

**Both lists page from the first day.** They ask for a page, they show what they have, and while there
is more they offer `Load more` and say how many are loaded. A list that silently stops at a hundred
rows is T-38, and this section is not allowed to repeat it. The number of people in a group is capped
explicitly, and the limit is said in the sheet that adds one, never discovered by a save that fails.

## A shared group (`#group`)

**A group has no month.** Cartagena trip runs from August into September, and a two-month trip is one
group. The header carries the **range of its expenses**, and nothing on the screen may assume a period:
not the figures, not the list, not a filter.

The header leads with **what still counts as yours**, with the total and your share under it as
context, then the bar of what has been collected, then the one sentence that explains the gap — what is
still owed and what was written off. Then the four actions: `Settle up`, `Add expense`, `Edit`,
`Archive`.

**People**, one row each, with the split named once above them. **You are a row like everybody else**,
with a share of your own. Four states:

| State            | Where it comes from                                 |
| ---------------- | --------------------------------------------------- |
| `Not paid`       | Derived from the money: nothing received            |
| `Partially paid` | Derived: something received, not all                |
| `Paid`           | Derived: everything received                        |
| `Written off`    | **Stored**, because it is a decision, not an amount |

**Expenses**, one row each, with its date, who paid it and your share. A line somebody else paid says
so and carries no movement of yours until you settle with them.

## A person (`#person`)

One contact across every group: what they owe you or you owe them, the groups they appear in with their
state in each, and the payments already made. `Settle up` is the primary action.

**A person is not an account**, and this screen says so at the bottom in one line. That is the whole
reason the contact is an entity of its own: paying Beto back must not touch balances, Stats, Budgets or
Categories, and every one of those would need a "except for people" exception if a person were an
account. A person has no type, no limit, no available balance and no `Pay this card`.

A contact is **archived, never deleted**, its name is unique per user like an account's, and its
**email is an identifier for inviting them later** — nothing is sent today, and the sheet that asks for
it says exactly that rather than leaving the field to be guessed at (`#new-person`).

## Creating a group (`#new-group`, `#pick-transactions`)

The flow is built around the habit it serves: **the expenses already exist**. They were recorded with
the Quick add during the night, and the group is assembled the next morning. So the form takes a name,
a colour, who was in, **a default split chosen once**, and then picks the expenses from the
transactions that are already there — over the group's own range, any account, with a checkbox on the
same row the list already draws. Recording a new expense from inside the group is the other way in and
lands in the same place.

**A new expense inherits the group's split without asking.** The split sheet is for changing one
expense, never for defining the rule again.

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

Under the rows, **what is left to assign**, always visible, and the sheet cannot be saved while it is
not zero. The shares always add up to the expense.

**The odd peso goes to whoever paid**, and the sheet says so in words. $100,000 does not divide by
three and the Colombian peso has no cents (T-67), so the remainder has to land somewhere chosen rather
than somewhere accidental. This is not decoration: the server and the offline projection have to
produce the same shares to the peso, or a difference appears that nobody can explain — which is what
the parity fixtures in `lib/local/derive` exist to prevent.

## Getting paid, and paying (`#settle-up`, `#settle-up-both-ways`, `#record-a-payment`)

**One sheet**, `Settle up`, reached from a person's row, from a group, or from a shared expense.
`Mark as paid` and `Record a payment` are the same sheet with the amount prefilled full or left to
type. It always settles **everything open between the two people**, and it says what it covers.

- **Money coming back is not income.** It arrives in an account, carries no category, and is excluded
  from Stats and from Budgets — the shape `ADJUSTMENT` already has. It is drawn neutral, never green.
- **What a payment covers is imputed oldest expense first.** That is why somebody can read
  `Partially paid` in a group and `Paid` on its first expense, and the sheet lists what it covers so
  the rule is visible rather than inferred.
- **A payment can be outside the app** — cash that never reached an account kept here. Then **no
  movement is created and no balance changes**, and the sheet says that plainly; the expenses still
  fall, because that money did come back. It is the one place where what counts as yours moves without
  an account moving, and it moves because the user said the money arrived.
- **When you owe them too, one payment writes both halves** (`#settle-up-both-ways`). Ana paid for the
  tickets and you paid for the rest, so the sheet shows the two directions and the net she actually
  sends, and then says what it will record: the collection arriving, **and** your share of her line as
  an expense in its category, dated the day of that line. The balance moves by the net. Splitting it
  into two movements is what keeps the categories exact; a single net movement would leave your share
  of the tickets counted nowhere.

## Writing off, and archiving (`#write-off`, `#archive-with-people-owing`)

**`Write off`** answers the owner's worry, and the answer is that there is nothing to do: no figure
changes, because the money was counted as his from the day he paid it. The sheet says exactly that, the
person's row becomes `Written off`, and it can be undone while the group is open.

**Archiving a group with people still owing writes those amounts off on your behalf**, so the
confirmation says what it will do and what it will not: the amount stays counted as yours, nothing is
deleted, and the group stays readable.

## The four states

- **Data** — the plates above.
- **Empty** (`#empty`) — one sentence explaining what a shared group is, and the two ways in.
- **Loading** — the list skeleton of [states.md](states.md), with the two summary figures as
  skeletons too: they are the part somebody came to read.
- **Error** — the screen's error with its reference, and, offline with no local copy, the honest
  empty state Transactions uses.

Offline, everything in this section is projected from the local mirror like every other figure, and
whatever includes an unconfirmed write carries the projection mark (component 24). What is shared with
other people is a second delivery (T-125 onwards); until then a group is yours alone, and nothing here
says otherwise.

## What this section is not, in v1

Sharing an income or a transfer, more than one currency inside a group, and weights expressed as shares
are all out. Inviting someone and letting them see the group in their own app is the second delivery,
and it changes nothing that is written here.
