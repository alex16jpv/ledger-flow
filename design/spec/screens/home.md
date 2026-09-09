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
- **Stats:** total balance (the sum of active accounts) and the month's income; a third card,
  "Estimated savings", only at 600px and up.
- **Budgets:** up to three, the ones with the highest share consumed, each with its tile, amount over
  limit and a sentence of status; "See all".
- **Accounts:** a carousel or grid of cards, the main account first; "See all".
- **Recent transactions:** the last five (`limit=5`), items to review first; "See all".
- **Desktop:** the left column holds the hero, the stats and the transactions; the right one holds
  budgets and accounts.
- **Empty states:** with no accounts, the hero is replaced by "Create your first account"; with no
  transactions this month, the hero shows $0 with empty bars and a call to action to add one.

## The install card, which is also the storage notice

`preview/home.html#install-card`

> The browser's half of this is already in the code: the app stopped cancelling
> `beforeinstallprompt`, so Chrome shows its own prompt again. What is missing is the half the browser
> cannot give: **on iOS that event does not exist**, and **the storage permission is never asked for in
> any browser** — it is granted by heuristics, and the lever is having the app installed. So the app
> gives the notice, and **they are the same notice**: installing is what makes the data durable.

- **Where:** a **card on Home**, below the review inbox and above the hero. Not a modal: the user came
  to record an expense, and a wall to talk about durability is exactly what this app does not do.
- **When it appears:** when the device **already has something to lose** — a first full copy
  (`syncedAt`) or something in the queue — **and** the app is running in a browser tab. Never when
  installed, never before the first copy: there is nothing to protect yet, and it would be noise in
  the first minute.
- **What it says:** an amber `monitor-smartphone` tile, the title **"Keep your data on this phone"**
  (ES «Conserva tus datos en este teléfono»), and the body **"This browser can delete what you record
  offline after a few days without opening the site. Installing the app stops that."** (ES «Este
  navegador puede borrar lo que registras sin conexión tras unos días sin abrir el sitio. Instalar la
  app lo evita.»). Actions: **"Install"** (primary) where the browser offered to, which fires its
  prompt, and **"How"** (secondary) where it did not, which opens the "Install this app" sheet with the
  steps for the browser in use. It is dismissed with **"Not now"** (ghost).
- **How often:** "Not now" hides it for **seven days**; the **third** time it is dismissed it does not
  come back — the Settings › About row and the Persistent storage row already say the same without
  insisting. Installing removes it for good. It is counted per device, alongside the other local
  preferences.
- **What it does not do:** it never promises the permission will be granted — the browser decides —
  and it never says "accept the permission", because **there is no permission to accept**: no
  persistent-storage dialog exists. It says what the user can do (install) and what they get for it
  (nothing gets deleted).
- **Once installed:** the Persistent storage row in Sync status turns to "Granted" on its own, without
  asking for anything, because browsers grant it to installed apps.
