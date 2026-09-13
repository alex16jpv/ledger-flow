# Components

Exact sizes and states live in `preview/assets/ui.css`; this is the behaviour.

1. **Button** — primary (brand), secondary (surface plus border-strong), soft (brand-soft), ghost,
   danger (soft), and solid danger only for destructive confirmations; sizes sm/md/lg; icon-only,
   square or round; `loading` shows a spinner and hides the label — **and under
   `prefers-reduced-motion` the spinner does not turn: the arc closes into a whole, still ring**;
   `disabled` drops to 0.5 opacity.
2. **Tile** — a 40px container (32 sm, 56 lg), radius 12, `--f-soft` background, `--f-text` icon. An
   `outline` variant (dashed) for "uncategorized" and "add".
3. **Row** — tile plus title (plus badges) plus metadata separated by dots, with the amount aligned
   right and a subtext under it. Minimum height 60px, hover `--surface-2`. A `pending` variant carries
   an amber gradient. Day headers show the day's total.
4. **Chip** — 32px, rounded; selected is `--ink`. A category chip carries a 20px mini-tile; selected
   is `--f-soft` with an `--f` border. Used for filters and for recent categories.
5. **Badge** — 20px: neutral, warning (To review), success (On track), danger (Over budget), info,
   brand (Main), outline (metadata such as "Day 22 of 30").
6. **Tag** — 22px with `#` in `--text-3`.
7. **Progress** — 6px (4 thin); `--f` fill; `warn` turns amber past 80%, `over` turns red past 100%.
   The **pace mark** is a 2px vertical line at the share of the period already spent (current day over
   days in the period). The mark **is a focusable `button`** with its own `aria-label` and a tooltip:
   "Day 22 of 30 · 73% expected" (ES "Día 22 de 30 · 73 % esperado"); on hover or focus it thickens to
   3px and loses its opacity. Where there is room — only the budget detail — it repeats the fact in a
   fixed line underneath: "The mark is today's pace: 73% of the period has passed (day 22 of 30)."
   (ES "La marca es el ritmo de hoy: ha pasado el 73 % del período (día 22 de 30).") — because a
   tooltip does not exist when the screen is read with a finger.
8. **Field** — 48px, a 12px label with "optional" on the right, 12px help text, errors with an icon in
   `--danger`; focus is a brand border plus the `--focus-ring` ring. Textarea 88px. A two-column group
   for date and time. The switch is 44×26.
9. **Large amount (`amount-input`)** — 52px semibold, a 20px symbol in `--text-3`, a brand caret; the
   native numeric keyboard (`inputmode="decimal"` or `numeric` depending on the currency).
10. **Segmented control** — 34px per option, `--surface-2` track, the selected one `--surface` with
    shadow 1; it colours its own label by type (income, transfer).
11. **Picker** — a 48px row with an sm tile, an 11px label and a 14px value, plus a chevron; it opens a
    sheet or modal with search and a list of rows.
12. **Bottom sheet / modal** — radius 28 on top, a 36×4 handle, a header with a title and a close
    button; at 600px and up it becomes a 520px modal with radius 20. It closes on the scrim, on ESC and
    on the drag gesture.
13. **Toast** — `--ink`, one action ("Undo"), five seconds, above the tab bar.
14. **Alert** — inline, four variants; the main-account warning uses `warning`.
15. **Empty** — an lg outline tile plus a title, a line and a call to action. The title is an `h2` at
    17 inside a screen that has its own header; where the `Empty` **is** the whole page — the 404, an
    error boundary — it carries the page's `h1` instead.
16. **Skeleton** — a 1.4s shimmer over `--surface-2/3`.
17. **Stat** — a 12px label, a 20px value, an 11px delta with an icon.
18. **Bars** — a daily series, one bar per day: brand at 35% opacity, the highest day and today at
    100%, a day with nothing spent in `--surface-3`, and **a day that has not arrived yet as a 1px rule
    in `--text-3`** — a day with no spending and a day that has not happened are not the same fact, and
    the chart may not draw them the same; a day that has not arrived is not a control and is hidden
    from readers. **Two modes, one component.** Where the slots lead somewhere — a day opens that day's
    transactions — each bar is a control: its accessible name is its day and its amount, it takes
    keyboard focus through the chart's roving `tabindex`, and it shows the same text on hover and on
    focus in a `Tooltip` (23) and in the `readout` (29). Where they lead nowhere — the average by
    weekday: there is no "all Wednesdays" to open — the chart is one `role="img"` whose accessible name
    reads every slot, and the bubble is a pointer convenience only; seven buttons that do nothing are
    worse than one image. The chart keeps a bubble's height of room above the tallest bar so the bubble
    never covers the card's title, and near either end the bubble aligns to that end instead of
    centring, so it never hangs outside the card. Home, Stats, the budget detail and the weekday average are this one component with a
    different height, different labels and a different mode — never a copy.
19. **Account card** — a 3px stripe of the colour on the left, a dot plus the name plus the Main badge,
    a 24px balance (negative with `−`) and an 11px type. On mobile it is a snapping carousel (72% of the
    width, 260px maximum); at 600px and up, an auto-fill grid.
20. **Period navigation** — 40px chevrons plus a 15px semibold label; "next" is disabled on the current
    period.
21. **Tab bar, sidebar and FAB** — see [layout.md](layout.md).
22. **Connection banner** — the first child of `main`, sticky, as wide as the content column and above
    the page header; it never covers the sidebar. **Seven states**: `offline` (amber, `wifi-off`),
    `pending` (amber, `cloud-off`, with a connection and a queue that has not drained), `online` (green,
    transient), `error` (red, `role="alert"`, with **two actions**: "Review" opens the first conflict
    and "See all" goes to `/sync`), `signedout` (amber, `log-in`), `blocked` (red, `cloud-alert`), and
    `localonly` (amber, `cloud-off`, permanent, neutral in tone because the user chose it). The
    component takes one action or a list of them. 12px medium text, a 20px icon, an optional subtext.
    Their copy and their priority live in [screens/sync-stripes.md](screens/sync-stripes.md).
23. **Tooltip** — a bubble over `--ink` with 11px medium text and an arrow, above the element, shown on
    hover and on keyboard focus; it is visual only (`aria-hidden`) because the control that carries it
    already has an accessible name. Used for: the colour's name in the swatches, the icon's name in the
    grid, the category of each segment of the stacked bar in Stats, **every slot of every chart that has
    slots** (18, 30, 32, 33 — 31 is a line, not slots, and puts its reading in the sentence and the
    `readout` beside it), the projection mark, and the pace mark. The exception to `aria-hidden` is the pace
    mark, which is not a control with a name of its own, so it carries its `aria-label` with the same
    text.
24. **Projection mark (`projected`)** — a 16px `cloud-off` icon in `--warning` next to a figure (aligned
    to its baseline) or a bar (centred), with the tooltip "Includes changes not yet synced". It appears
    on **every amount, balance, `spent`, percentage or bar** that includes a write the server has not
    confirmed: a projection is never painted as a figure the server sent. It is never drawn inside the
    number and it never changes the number's colour. The per-row equivalent is the "Pending sync" badge.
25. **Step dots (`step-dots`)** — 6px dots, the active one stretching to 22px in `--brand`; `role="img"` labelled
    "Step n of m". Used by onboarding.
26. **Comparison card (`compare`)** — a section with an eyebrow ("On the server" / "On this device") and
    a `dl` of field → value; the disputed row carries a `--warning-soft` background and `--warning` text.
    Two cards side by side at 600px and up, stacked below. Only the conflict sheet uses it.
27. **Rename-on-restore sheet** — a sheet with a `warning` alert ("An active account is already named
    “X”. Choose another name to restore this one."), a "New name" field and the call to action "Restore
    as “Y”", disabled while empty. One component for accounts and categories **and for the same clash
    seen from the queue**, where it lives inside the conflict sheet instead of opening a new one.
28. **Own calendar and clock (`cal`, `wheel`)** — they replace the browser's, which follow neither the
    tokens nor the app's language. **Calendar:** a header with the month and chevrons ("next" is
    disabled once it reaches the current month), a row of day initials following the language's first
    day of the week, and a 7×n grid of 40px cells; the selected day in `--brand`, today with a
    `border-strong` ring, neighbouring months' days at 55%, and **every day after tomorrow disabled**
    (the server refuses anything more than 24 hours ahead). Above it, the chips "Today" and "Yesterday".
    **Time:** two scrolling, snapping columns (hours; minutes in fives), the chosen value over
    `--surface` with a shadow, a "Now" button and, in 12-hour languages, a third AM/PM column. Both are
    sheets (`role="dialog"`, a 360px modal at 600px and up) with "Cancel" and "Done", full keyboard
    support (arrows move the day, `PageUp`/`PageDown` change month, `Enter` picks) and a footer line
    with the user's time zone.
29. **Readout (`readout`)** — the fixed line under a chart: on the left what the pointer or the focus
    is on, on the right its amount. With nothing pointed at, it says what the chart shows as a whole —
    the highest day, the month still running. It exists because **a tooltip does not exist for a
    finger**, which is the answer the pace mark already got (F-08); on a touch screen the line is the
    only reading, and it is never the only place a figure appears.
30. **Grouped bars (`gbars`)** — two series in one slot: income in `--income`, spending in `--brand`,
    one pair per month. A period still running is **hatched** and its readout says "in progress"; it
    is **never** counted into an average, a total or a rate that claims to be a finished period's.
31. **Trend (`trend`)** — one or more lines over the same x axis: solid is what happened, dashed
    `--text-3` is a reference (the period's pace, the same days of the previous month), dashed
    `--danger` is a limit or a projection. The live line ends in a dot. A line may start late — a
    projection starts at today — and the gap is drawn as a gap, never interpolated backwards.
32. **Calendar heatmap (`heat`)** — the same days as `Bars`, laid out as the month: one cell per day in
    four steps of `--brand`, `--surface-3` for a day with nothing spent, an outline for a day that has
    not arrived, today ringed, and a Less/More scale. Weeks start on the language's first day, like the
    calendar sheet (28). It answers what a row of bars hides — which weeks, which weekdays — so the two
    are one toggle over one set of data, never two screens.

33. **Stacked columns (`colbars`)** — one column per period, built of segments. Two uses, one
    implementation: the top categories stacked inside each month, and a **single** segment with the
    period's limit drawn as a dashed cap across the column (an adjusted month does not share the base
    amount, so the cap is per column, never one rule across the chart) and the segment in `--danger`
    when it is over. A period still running is **hatched** and is excluded from any count in the line
    underneath.

**Every chart obeys the same contract**, and every shape has exactly one implementation: a slot — a
bar, a cell, a column, a pair — carries its name and its amount as its accessible name; it shows that
same text on hover and on keyboard focus through `Tooltip` (23); it repeats it in the `readout` (29)
for a finger; and where there is a list behind the slot, the slot is a control that opens that list
already filtered. A chart drawn from figures that include an unconfirmed write carries the projection
mark (24), exactly like a number does.
