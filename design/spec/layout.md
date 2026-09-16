# Layout and navigation

- **Below 900px (mobile, portrait tablet):** a 64px tab bar plus safe area with five positions: Home ·
  Transactions · **Add** (a raised 52px FAB) · Budgets · Accounts. An amber dot sits on Transactions
  when something is waiting to be reviewed. **Categories and Settings are reached only through Home's
  avatar → Settings, and Stats and Trends cannot be reached at all below 900px**: no screen links to
  them, so the sidebar's six destinations are four on a phone. That is the open decision of T-72, and
  its alternatives are drawn in `preview/variants.html`.
- **900px and up:** a 240px sidebar with the brand, an "Add" button, Home, Transactions (with the
  count of items to review), Budgets, Accounts, Stats and Categories; the footer holds Settings and
  the user. Content is capped at 1120px, and Home splits into two columns (1.6fr / 1fr).
- **600px and up:** grids of two or three columns, and bottom sheets become a centred 520px modal.
- **Page header:** eyebrow plus h1 on the left, actions on the right (40px icon-only, 36px avatar).
  Forms: a header with back and a centred title, a maximum width of 640px, and a 48px save button at
  the end of the form — pinned above the keyboard on mobile.
