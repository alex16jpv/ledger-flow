# The map of the app

Full coverage of the backend. Status per screen: ✅ specified and drawn · ⬜ specified only · 🔮 future,
with the space reserved.

## Public (indexable; the whole of the SEO surface)

✅ Landing (`/`): value proposition, three benefits, three steps, a call to action to sign up, the
language switch and the legal footer · ✅ Privacy and data processing policy (Ley 1581) · ⬜ Terms
(same layout as privacy) · ✅ 404 · ⬜ 500 and the landing's offline page (the same `Empty`). Every
public page exists in `en` and `es` with its own URL (`/es/...`) and `hreflang`. Everything signed-in
is `noindex`.

## Access

✅ Sign in · ✅ Sign up (name, email, password, currency suggested by `Intl` and confirmable, detected
time zone) · ✅ reactivation notice (`reactivated: true`) · ✅ the 429 state; ⬜ "a 500 while signing
up → try signing in" (copy only) · 🔮 email verification and forgotten password (link visible but
inactive, marked "soon").

✅ A two-step onboarding after signing up: the first account, with its opening balance, then the total
monthly budget.

## Home ✅

The month's spending with a bar per day, progress against the global budget, the review inbox, total
balance and income, the top budgets, accounts, and recent transactions.

## Add ✅

The quick-capture sheet (`POST /transactions/quick`, with an `Idempotency-Key`), which records an
expense, an income or a transfer, and the full form, which adds ADJUSTMENT (`POST /transactions`). Category, account and date/time open
sheets built on the `picker` component plus a searchable list of rows. Tag autocomplete offers chips
under the field.

## Sync (across the whole app) ✅

The **attention tray** (`/sync`: one card per stuck change, actions per card and in bulk, a discard
confirmation that names the cascade) · **Settings › Sync status** (`/settings/sync`: cursor, last update,
queue, sending mode, storage, persistence, installed or tab, a link to the tray, and Force full
resync) · the **Resolve sync conflict** sheet in its seven shapes · **local mode** with a dead session
· the offline fallback document · and the **projection mark** on any amount or bar that includes
writes the server has not confirmed.

## Transactions ✅

A list grouped by day with totals, search, filters (type, account, category, uncategorized, tag,
range, to review, source QUICK), cursor pagination that reloads on `INVALID_CURSOR`, and infinite
scroll driven by `hasMore`. ✅ Detail (with source, currency, created and edited dates) · ✅ edit (the
same form as Add) · ✅ delete (soft, with a confirmation; no restore, by decision R2-07). ✅ **Review
inbox**: quick adds completed inline (category, description) and marked done.

## Accounts ✅

A list with the main account, type, colour and balance; archived ones collapsed
(`includeArchived`). ✅ Detail (balance, opening balance, the account's transactions, and the actions:
edit, make main with a warning, adjust balance, archive and restore). ✅ New and edit (a name unique
case-insensitively → an inline 409, type, colour, opening balance only when creating). ✅ **Adjust
balance**: the user enters the real balance, the app computes the delta and creates the ADJUSTMENT. ✅
Errors: `DEFAULT_ACCOUNT_ARCHIVE_BLOCKED` (a notice in the detail), `DUPLICATE` (inline), and
`ACCOUNT_LIMIT_REACHED` as an alert above the create button.

## Shared ✅

Expenses split with other people. ✅ The section with its two faces — **People**, the net per person
across every group, and **Shared groups**, each with its date range because a group has no month — and
the detail of a group with its participants, their four states and its expenses. ✅ A person: what they
owe you across every group and what they have already paid. ✅ Creating a group from transactions that
already exist, or from scratch, and `Split this` over a single one. ✅ The split sheet in its four
modes, with the odd peso going to whoever paid, ✅ an expense carrying its own split instead of the
group's, and ✅ an expense with **guests**, who weigh a head count and settle as one row. ✅ Adding
people after the group exists, with the question of what happens to the expenses already recorded. ✅ Getting paid — money that is not income, partial
payments, cash outside the app, and the case where the two of you owe each other — ✅ writing off, and
✅ archiving a group with people still owing, ✅ a group two people paid for, and ✅ the contact
picker, where the paging and the two limits are said. ✅ Loading and error, and ✅ the `Percent` and
`Exact` modes of the split sheet. Everything is written in [screens/shared.md](screens/shared.md) and
built. ✅ Inviting the people in a group by their email, withdrawing and stopping sharing, and ✅ the
invitations waiting for you above both faces — with how they are found from More and the sidebar, a
group in another currency, answered and offline. ✅ What somebody who joined sees of the group — under
`Shared with you`, read-only, archived or not — ✅ `Add to my ledger` on the lines the owner marked paid,
and ✅ leaving it.

## Notifications ✅

✅ How they arrive — the bell in Home's header, the dot on More and the count in the sidebar — ✅ the
inbox at `/notifications`, newest first, with what is new, what is unread, the two answers of an
invitation and how it ended, ✅ changes to one group folded into one row, ✅ its empty, loading, error,
offline and this-device-only states, and ✅ Settings › Notifications, one switch per topic and per
channel that exists. Written in [screens/notifications.md](screens/notifications.md); **nothing of it
is built yet**, and it is not scheduled: the backend is T-127 and the inbox T-128. 🔮 Email and push add a column
each to the settings page.

## Categories ✅

A grid per type (expense, income, transfer) with icon and colour; archived ones in a folded section;
"restore defaults", which reports how many were created. ✅ New and edit: name, type (locked once
there is history → `CATEGORY_TYPE_LOCKED` and a call to action to create another), icon (a grid over
the curated set, with search) and colour. ✅ Archiving confirms and explains what is kept.

## Budgets ✅

The list · ✅ Detail (progress, the current period and earlier ones through `?reference=`, the
period's transactions, the amount override: set / 0 "does not apply this period" / remove, categories
flagged when archived, note, `effectiveFrom`). ⬜ **What the period is doing**: spending per day over
the budget's own period, the cumulative curve against the pace with where it ends at this rate, the
last six periods against their limits, the biggest movements, and — for a budget of several categories
— which of them is eating it. All but the pace curve need the backend first (`categoryIds` on
`GET /stats/spending`, an order on `GET /transactions`). ✅ New and edit: name, type EXPENSE (INCOME hidden,
backend-ready), several categories or global, period (WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY,
CUSTOM with dates), amount, colour, note, effective from; warnings when the period or the dates change
(overrides are cleared); errors `BUDGET_PERIOD_OVERLAP` and `CATEGORY_TYPE_MISMATCH` (TRANSFER
categories are never offered). ✅ Past (`includeExpired`) and archived budgets. 🔮 Income goals,
rollover, an alert threshold, SEMIMONTHLY.

## Stats ✅

A navigable period (a month by default), spending by category (a stacked bar plus a list that drills
down into the filtered transactions), by day (bars with gaps filled, every bar naming its day and
opening it), by tag (with a note about double counting), and a switchable flow type; archived
categories resolved with `includeArchived`; ADJUSTMENT excluded unless explicitly selected.
✅ **By day as a calendar** (a toggle over the same data), ✅ **the average by weekday**, ✅ **the
biggest movements of the period** and ✅ **by account** — all four since T-27 and T-29, on the order and
the `groupBy=account` the backend gained in T-25 and T-24. Every view ends with the way into Trends.
🔮 Consolidated multi-currency reports.

## Trends ✅

`/stats/trends`, reached from Stats: a range of six or twelve months ending on the month Stats was
showing; income against spending per month with what was saved and the savings rate over the complete
months only; this month against the same days of the last one; and spending per category month by
month. Rides on the `groupBy=month` and the month × category cross the backend gained in T-24. 🔮
**Recurring expenses** — found by the app, set up by the user, or both: the question is written up in
`screens/trends.md` and drawn in `variants.html`, and the owner chose detection first (2026-09-11).

## Settings ✅

Profile (name, email and password with `currentPassword`; a warning that other sessions close) ·
Preferences (**language**: follow the device / English / Español, English by default; currency with a
locked state and the `CURRENCY_LOCKED` explanation; time zone, which refreshes the token after a
change) · Appearance (palette, light/dark/system) · Active sessions (`GET`/`DELETE /auth/sessions`,
"sign out all") · Categories (a shortcut) · Data (export 🔮, import 🔮, visible rows badged "soon") ·
Sign out · Delete account (soft delete, explaining reactivation). 🔮 A currency per account, transfers
across currencies, scheduled transactions.

## System states (across the whole app) ✅

An empty state per screen with its call to action, loading skeletons, a network or 503 error with a
retry, an expired session (silent refresh; `REFRESH_REVOKED` → a sheet that leads to sign-in), a 429
with a countdown, confirmations for archiving, toasts with undo, and offline.
