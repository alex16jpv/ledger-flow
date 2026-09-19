# Home

`preview/home.html`

- **Header:** an eyebrow with the long date, an h1 "Hi, {name}"; actions are search (desktop only) and
  the avatar, which leads to Settings.

  **Where the name comes from, and what happens when there is none** (`#home-without-a-name`): the
  name and the avatar's initials come from the session **or, with no session, from the profile the
  local mirror saved** — the same source that already provides the currency and the time zone offline
  — so without a connection the greeting is still "Hi, Alex". **With neither** — a device that never
  finished a pull — the greeting **is not left with a dangling comma**: it becomes plain "Hi" and the
  avatar shows its `user` icon instead of empty initials. The general rule: **no text in the app shows
  the punctuation of a fact it does not have**; the sentence is rewritten without it.

- **Review inbox:** a clickable `warning` alert with the count and the sum
  (`GET /transactions?pendingDetails=true`); hidden when there is nothing to review.
- **Hero card:** the eyebrow "{month} spending", a "Day n of N" badge, the hero amount from
  `GET /stats/spending?type=EXPENSE&from=start of month&to=start of the next` (bounds in the user's
  zone, converted to UTC), a line with the daily average and yesterday's spending, bars per day
  (`groupBy=day`, gaps filled with zero, today highlighted), and progress against the global monthly
  budget with the pace mark. With no global budget, the progress line is replaced by a call to action
  to create one.

  **The bars answer which day** (`#hero-day-tooltip`): each one is a control that says its day and its
  amount on hover, on keyboard focus and in the `readout` line under the chart, and opens that day's
  transactions where the pointer can hover or the key is pressed — never on a bare tap, which is the
  only reading a finger has (T-80, the chart contract in [components.md](../components.md)) — the same
  `Bars` as Stats, with the same contract, because it is the same component and always was. Days that have not arrived are drawn as a rule, not as a zero. The figures above the chart
  — the hero amount, the daily average, yesterday — are the same series added up, so the chart and the
  numbers can never disagree.

- **Stats:** total balance (the sum of active accounts) and the month's income; a third card,
  "Estimated savings", only at 600px and up.
- **Budgets:** up to three, the ones with the highest share consumed, each with its tile, amount over
  limit and a sentence of status; "See all".
- **Accounts:** a carousel or grid of cards, the main account first; **each card opens that
  account's detail**, the same as in Accounts, and "See all" opens the list.
- **Recent transactions:** the last five (`limit=5`), items to review first; "See all".
- **Desktop:** the left column holds the hero, the stats and the transactions; the right one holds
  budgets and accounts.
- **Empty states:** with no accounts, the hero is replaced by "Create your first account"; with no
  transactions this month, the hero shows $0 with empty bars and a call to action to add one.

## The install card, which is also the storage notice

`preview/home.html#install-card` · `preview/home.html#install-card-safe`

> The browser's half is already in the code: the app does not cancel `beforeinstallprompt`, so Chrome
> shows its own invitation, and the card's **Install** fires that same native dialog rather than one of
> ours. What the browser cannot give: **on iOS no such event exists at all** — there is no way for a
> page to ask, and Add to Home Screen is done by hand — and **no browser ever asks about durable
> storage**; it is granted by heuristics and the lever is having the app installed.
>
> So how hard the app insists depends on the platform, because what the user stands to lose is not the
> same on each (owner, 2026-09-11).

- **Where:** a **card on Home**, below the review inbox and above the hero. Not a modal: the user came
  to record an expense, and a wall to talk about durability is exactly what this app does not do.
- **When it appears:** when the device **already has something to lose** — a first full copy
  (`syncedAt`) or something in the queue —, the app is running in a **browser tab**, and the device is
  **not a desktop**. Never when installed, never before the first copy.
- **Never on a desktop.** There the browser puts its own install button in the address bar and
  **Settings › About** carries the row that explains the rest. A card on top of that is insistence
  without a reason: nothing is being deleted on a machine whose browser granted durable storage, and
  the user who wants the app finds it where it is.
- **How often, and this is the part that differs:**

  | Platform | "Not now" hides it for   | Gives up                   |
  | -------- | ------------------------ | -------------------------- |
  | iOS      | **3 days**               | **never**                  |
  | Android  | **7 days**               | on the **third** dismissal |
  | Desktop  | the card does not appear | —                          |

  iOS never gives up because it is the one place where the data really does go away — Safari deletes a
  site's storage after seven days in which the user does not open it — and the one place with no
  install prompt of any kind. Three days is not a race against that deadline: opening the app resets
  Safari's clock, so whoever sees the card was never going to lose anything that week. It is short
  because the only chance to convince someone is while they are still active, before they drift away.
  Installing removes the card for good on every platform.

- **What it says.** An amber `monitor-smartphone` tile, the title **"For when there's no connection"**
  (ES «Para cuando no haya conexión»), and the body **"Ledger Flow already keeps a copy on this device,
  so it works with no signal. Installed, it opens on its own, outside the browser."** (ES «Ledger Flow
  ya guarda una copia en este dispositivo, así que funciona sin señal. Instalada, se abre sola, fuera
  del navegador.»). The app is **completely usable from the browser tab**, so the card leads with the
  one thing installing is actually for, and never says "phone" — it also shows on tablets.
- **And one more sentence, only where it is true:** where the browser has **not** granted durable
  storage, the card adds **"This browser can also delete what you record offline after a few days
  without opening the site. Installing the app stops that."** (ES «Este navegador además puede borrar
  lo que registras sin conexión tras unos días sin abrir el sitio. Instalar la app lo evita.») That is
  every iPhone, and any Android whose browser said no. Where the browser already granted it — most
  Android Chrome — the sentence is **absent**: the app asked and was told yes, so claiming the data can
  be deleted would be a lie, and a warning that is not true is worse than no warning.
- **Actions:** **"Install"** (primary) where the browser offered to, which fires its prompt, and
  **"How"** (secondary) where it did not, which opens the "Install this app" sheet with the steps for
  the platform in use. Dismissed with **"Not now"** (ghost).
- **What it does not do:** it never promises the permission will be granted — the browser decides —
  and it never says "accept the permission", because **there is no permission to accept**: no
  persistent-storage dialog exists.
- **Once installed:** the Persistent storage row in Sync status turns to "Granted" on its own, without
  asking for anything, because browsers grant it to installed apps.

## What you have and what you owe (T-85)

The Stats row led with **Total balance**, the sum of the active accounts' balances. The sum is a signed
one, so a debt already subtracted and the arithmetic was never wrong; what the card never said is that
some of those accounts are money owed.

**It becomes two cards** (`#home-have-and-owe`): **What you have** and **What you owe**, and **no net
figure anywhere on Home**. His reason, on 2026-09-17, and it is correct: a car loan is tens of millions
against a few in the bank, so a net total would read negative for years — until the car is paid — and
that is a true figure nobody wants on the screen they open to record a coffee. Net worth is a real
number; it is not this screen's number.

**What each figure takes in is stated once, in [accounts.md](accounts.md)**, because the two screens
read the same split: a debt account below zero is what you owe, and a **loan paid past zero is in
neither** (T-102).

_Income this month_ and _Estimated savings_ **both stay** — he asked for it explicitly, after a first
draft dropped the savings card. The row is four cards in **two pairs**: what you have and what you owe
above, income and savings below. `Estimated savings` takes a 600px floor — it had 640 — so a phone
shows three cards and nothing is lost compared to now.

Measured at 460px in the preview frame: the stats row goes from **104px to 221px**, and the accounts
carousel grows **37px** because it is as tall as its tallest card and the debt cards are taller — the
page ends at **1,568px** against 1,415 today. `#home-total-with-a-line` (the total with the split under
it) and `#home-total-unchanged` (today's card) stay drawn as the record of why.

The reading inside the carousel's cards is [accounts.md](accounts.md)'s, and the **Accounts summary
card takes this same shape**, so the product never says it two ways.
