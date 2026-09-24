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
   native numeric keyboard (`inputmode="decimal"` or `numeric` depending on the currency). The keypad
   follows the device, not the app, so either `.` or `,` typed as the first separator is the decimal
   point, and it turns back into a thousands group when a third digit is typed after it at the end
   (T-160). Until the user's currency is known it takes no typing (read-only), and when the currency
   arrives it rewrites the figure it holds with that currency's decimals (T-159). **A second
   size, 28px with a 16px symbol** (T-94), for a second amount beside the one a screen is about — the
   interest inside a loan instalment: at 52px the two would read as equals.
   It takes an **optional figure from its parent**, and adjusts its text only when the figure is one it
   did not itself produce, so filling it from a chip never rewrites a half-typed decimal.
10. **Segmented control** — 34px per option, `--surface-2` track, the selected one `--surface` with
    shadow 1; it colours its own label by type (income, transfer).
11. **Picker** — a 48px row with an sm tile, an 11px label and a 14px value, plus a chevron; it opens a
    sheet or modal with search and a list of rows.
12. **Sheet** — every overlay in the product. **Below 600px it takes one of two forms** (T-150, the
    owner's decision of 2026-09-23 that no phone sheet rises from the bottom, and his correction the same
    day that the structure has to follow the mobile standard, not just move): **a form — more than one
    field — or a list that scrolls is a full-screen dialog** (Material 3's full-screen dialog, iOS's
    sheet with a navigation bar); **a question with its answers, a short choice, or one field with its
    button is a centred dialog**. The full-screen dialog has a 56px bar on top — the close button on the
    left, the title, and the sheet's one primary action on the right, `md` — and the body scrolls under
    it; the footer's other buttons end the body, and its Cancel is the close button. So the keyboard can
    cover part of the body and never the action. The centred dialog is a card 16px from the sides with
    radius 28, keeps its footer, and is centred on what the screen shows. **With the keyboard up, every
    sheet fits the area above it** (the `visualViewport`), on every width, since a phone on its side is
    wider than 600px: the full-screen dialog ends there, and a centred one centres there. The top of a full-screen dialog is padded by `--safe-top` and the end of its body by
    `--safe-bottom`. **From 600px up both are the same centred modal** — 520px, or 360px for the
    calendar and the clock, radius 20, a header with the title and the close button, the footer
    underneath. There is no bar to drag on any sheet any more. **The page behind is tinted by
    `--overlay` and blurred by `--overlay-blur`** (T-77), so the sheet reads as a layer and not as
    something sitting inside the screen; those two tokens are the whole setting, and a blur of 0 turns
    that half off. The same `--nav-blur`/`--overlay-blur` pair is what the tab bar and the preview's
    `.scrim` read, so no overlay in the product carries a hardcoded radius. Both drop to 0 under
    `prefers-reduced-transparency`. **It closes on a tap outside the sheet and on ESC**, except in the
    two sheets that turn `dismissible` off: the three exits of local mode, where a choice has to be
    made, and the expired-session sheet, which outside local mode has only one way out. **A sheet whose
    form has something typed does not close on any of its four exits**: it asks, in a centred dialog over
    the sheet on every width, with "Keep editing" as the primary and focused action and "Leave" as the
    quiet one, everything behind the question inert, and ESC answering "Keep editing" (T-78, drawn as
    `unsaved-before-leaving` in [screens/states.md](screens/states.md)). **Since T-104 the four ask**
    (his decision, 2026-09-18: «para evirar problemas de miss click»). The footer's Cancel is
    `SheetCancel` and its primary is `SheetAction`, which the sheet places itself, so Cancel asks the
    same question the other three do and the primary lands in the bar of a full-screen dialog.
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
    worse than one image. **Reading every slot is for a chart with few of them.** Seven weekdays are a
    sentence; thirty-one days of a line (31) are not, and there the accessible name is the card's own
    sentence — see 31. The chart keeps a bubble's height of room above the tallest bar so the bubble
    never covers the card's title, and near either end the bubble aligns to that end instead of
    centring, so it never hangs outside the card. Home, Stats, the budget detail and the weekday average are this one component with a
    different height, different labels and a different mode — never a copy.
19. **Account card** — a 3px stripe of the colour on the left, a dot plus the name plus the Main badge,
    a 24px balance (negative with `−`) and an 11px type. **The card is the link to that account's
    detail** — the whole card, wherever it is listed: Home and Accounts are the same control, and the
    only card that is not a link is the preview inside the account form. On mobile it is a snapping
    carousel (72% of the width, 260px maximum); at 600px and up, an auto-fill grid.
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
    already has an accessible name. **One variant has no arrow**: the line chart's (31), which is as
    wide as the card and truncates rather than hang outside it, because a day of a month is narrower
    than the reading it carries. There the rule and the dot point at the position, not an arrow, and
    the bubble follows the pointer only — a line has nothing to focus. Used for: the colour's name in the swatches, the icon's name in the
    grid, the category of each segment of the stacked bar in Stats, **every slot of every chart**
    (18, 30, 32, 33, and the x positions of 31), the projection mark, and the pace mark. The exception to `aria-hidden` is the pace
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
    **The x positions are slots too.** Pointing at one names that day and reads **every line at it**,
    in a `Tooltip` (23) and in the `readout` (29); a vertical rule in `--border-strong` marks the
    position and each line takes a dot there, so the reading and the picture are the same point. With
    nothing pointed at, the `readout` reads the last position that has one. **A finger points by
    sliding** (T-81): a touch on the chart reads the position it landed on and every position it is
    dragged across, which is the gesture every line chart on a phone already has, and the reading stays
    where the finger left it. The chart keeps the page's vertical scroll — only the horizontal axis is
    the chart's — so a flick down the page passes over it without reading anything. The positions are
    **not** controls — a day of a two-month comparison, or of a pace curve, opens nothing — so the
    chart stays one `role="img"`, and **its accessible name is the card's sentence, not the thirty-one
    readings**:
    that is where this piece parts from 18, and why the `readout` matters more here than anywhere
    else. A position with nothing to read — the origin of a cumulative curve, a day the previous month
    never reached — has no slot and no bubble.
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

34. **Person avatar (`avatar person`)** — the 36px `avatar` with the contact’s own feature colour
    instead of the brand one: `--f-soft` behind, `--f-text` for the initials, `--f-border` around.
    Two more sizes: 22px inside a chip or a stack, 56px as the hero of a person’s screen. The initials
    are decoration — the name is always written next to it — so it is `aria-hidden`, and a person with
    one word for a name gets one letter rather than an invented second. It is the only avatar that is
    not the signed-in user, and it is what keeps a person from ever looking like an account: no tile,
    no type, no balance.
35. **Selectable row (`row` with a `box`)** — the same 60px row every list already draws, with a 20px
    checkbox first. Used where a screen picks from something that already exists — the transactions
    that go into a shared group — so the thing being picked is shown exactly as the list shows it,
    never as a stripped-down copy. The box is a real `input[type=checkbox]` visually replaced by the 20px square, the whole
    row is its `<label>`, and its accessible name is the row's own title and metadata. The footer button
    counts what is selected and adds up their amounts, and nothing is selected by a scroll.

**Every chart obeys the same contract**, and every shape has exactly one implementation: a slot — a
bar, a cell, a column, a pair — carries its name and its amount as its accessible name (a position on
a line is the exception 31 states); it shows that
same text on hover and on keyboard focus through `Tooltip` (23); it repeats it in the `readout` (29)
for a finger; and where there is a list behind the slot, the slot is a control that opens that list
already filtered — **but it opens it only where the pointer can hover**. Where it cannot,
`(hover: none)`, **the tap is the reading and nothing else**: it takes the slot's focus, raises its
bubble and writes its `readout` line, and it goes nowhere. On a touch screen a tap is the only way to
read a slot, so a tap that also navigates takes the screen away before the figure can be read; that is
why the slot stays a control there instead of becoming part of an image — it has to take focus to be
read. The cut is what the pointer can do, never the width of the screen: a desktop window narrowed
below the mobile layout still hovers and still opens, and a wide tablet neither hovers nor opens. A
device that declares nothing keeps the pointer's behaviour. A chart drawn from figures that include an
unconfirmed write carries the projection mark (24), exactly like a number does.
