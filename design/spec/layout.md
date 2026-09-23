# Layout and navigation

- **Below 900px (mobile, portrait tablet):** a 64px tab bar plus safe area with five positions: Home ·
  Transactions · **Add** (a raised 52px FAB) · Budgets · **More**. An amber dot sits on Transactions
  when something is waiting to be reviewed, and a brand dot on More while a notification is unseen
  ([screens/notifications.md](screens/notifications.md)) or an invitation to a shared group is waiting
  to be answered ([screens/shared.md](screens/shared.md#how-it-is-found-invitations-in-more)).
- **More** (the `ellipsis` icon) opens a sheet titled "More" with the destinations the bar
  cannot hold: **Accounts** (with its count), **Shared** (with what people owe you, or the invitations
  waiting for you, with their count), **Notifications**
  (with what is new), **Stats**,
  **Categories**, **Settings**, and the user's row at the bottom. It is the sidebar's list minus what the bar already has, and it is the owner's
  choice of 2026-09-15 over the four alternatives that stay drawn in `preview/variants.html`. Accounts
  gives up its tab to make room, so on a phone it is two taps instead of one — the price he accepted.
  **Trends is not in the sheet**: it is reached from a Stats view, and its back arrow points at Stats.
  The counts under Accounts and Categories are a courtesy, not the row: when the mirror cannot answer
  — a private window, site storage blocked, the copy not filled yet — **the line is simply not drawn**,
  and the destination is reached exactly the same. That is the intended behaviour, confirmed by the
  owner on 2026-09-16; it is not a swallowed error.
  More is a button, not a link: it says `aria-haspopup="dialog"` and carries the selected look while
  its sheet is open **and** whenever the screen underneath is one of its destinations, so the bar
  never stops saying where you are. Taking a destination closes the sheet.
- **900px and up:** a 240px sidebar with the brand, an "Add" button, Home, Transactions (with the
  count of items to review), **Notifications** (with the count of what is new, in brand rather than
  amber), Budgets, Accounts, **Shared** (with the count of invitations waiting, in brand), Stats and
  Categories; the footer holds
  Settings and the user. Shared sits next to Accounts because it answers the same question — where
  the money is — and it is the one destination that is about people rather than about your own ledger
  ([screens/shared.md](screens/shared.md)). Content is capped at 1120px, and Home splits into two columns (1.6fr / 1fr).
- **1200px and up:** **Stats** splits into the same two columns (1.6fr / 1fr) — the owner's choice of
  2026-09-16 (T-82): the answer on the left, the follow-ups and the way into Trends on the right. Not
  at 900px like Home: there the sidebar leaves 596px of content and the wide column lands at 272px,
  narrower than a phone. Stats' empty, loading and error states stay one column at every width.
- **The bottom safe area** (`--safe-bottom`, the phone's navigation bar or home indicator when the
  app draws under it) is never covered by a control: the tab bar grows by it, the toast rises by it,
  a full-screen sheet pads the end of its body by it, and the full-page frames (sign-in, onboarding, the public
  pages, the error pages) end that far above the edge. Where there is no inset it is 0px.
- **The top safe area** (`--safe-top`, the status bar or the notch when the app draws under it) pads
  the top of a full-screen sheet. Where there is no inset it is 0px.
- **600px and up:** grids of two or three columns, and every sheet is a centred 520px modal
  ([components.md](components.md) §12).
- **Page header:** eyebrow plus h1 on the left, actions on the right (40px icon-only, 36px avatar).
  Forms: a header with back and a centred title, a maximum width of 640px, and a 48px save button at
  the end of the form — pinned above the keyboard on mobile.
