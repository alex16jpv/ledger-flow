# Layout and navigation

- **Below 900px (mobile, portrait tablet):** a 64px tab bar plus safe area with five positions: Home ·
  Transactions · **Add** (a raised 52px FAB) · Budgets · **More**. An amber dot sits on Transactions
  when something is waiting to be reviewed.
- **More** (the `ellipsis` icon) opens a bottom sheet titled "More" with the destinations the bar
  cannot hold: **Accounts** (with its count), **Stats**, **Categories**, **Settings**, and the user's
  row at the bottom. It is the sidebar's list minus what the bar already has, and it is the owner's
  choice of 2026-09-15 over the four alternatives that stay drawn in `preview/variants.html`. Accounts
  gives up its tab to make room, so on a phone it is two taps instead of one — the price he accepted.
  **Trends is not in the sheet**: it is reached from a Stats view, and its back arrow points at Stats.
  The counts under Accounts and Categories are a courtesy, not the row: when the mirror cannot answer
  — a private window, site storage blocked, the copy not filled yet — **the line is simply not drawn**,
  and the destination is reached exactly the same. That is the intended behaviour, confirmed by the
  owner on 2026-09-16; it is not a swallowed error.
  More is a button, not a link: it says `aria-haspopup="dialog"` and carries the selected look while
  its sheet is open **and** whenever the screen underneath is one of its four destinations, so the bar
  never stops saying where you are. Taking a destination closes the sheet.
- **900px and up:** a 240px sidebar with the brand, an "Add" button, Home, Transactions (with the
  count of items to review), Budgets, Accounts, Stats and Categories; the footer holds Settings and
  the user. Content is capped at 1120px, and Home splits into two columns (1.6fr / 1fr).
- **600px and up:** grids of two or three columns, and bottom sheets become a centred 520px modal.
- **Page header:** eyebrow plus h1 on the left, actions on the right (40px icon-only, 36px avatar).
  Forms: a header with back and a centred title, a maximum width of 640px, and a 48px save button at
  the end of the form — pinned above the keyboard on mobile.
