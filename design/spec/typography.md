# Typography, space, shape, motion

- **Family:** Geist variable (OFL) for everything; Geist Mono only for technical keys — a period
  (`2026-09`), a currency code, a session's user agent.
- **Scale (px):** 11 eyebrow (uppercase, 0.06em tracking, `--text-3`) · 12 small · 14 base · 15 md
  · **16 field** · 17 h2 · 20 stat · 24 h1 and amount-lg · 40 amount-hero · 52 the amount in quick
  capture. **A field's own value is 16 and never smaller:** iOS zooms the page in on focus for
  anything below that, and leaves it zoomed. Weights 400/500/600; line height 1.45 for text and 1.2
  for titles; tracking −0.01em in general and −0.02/−0.03em on large amounts.
- **Amounts:** `font-variant-numeric: tabular-nums`; the currency symbol in `--text-3` and smaller;
  `−` (U+2212) for money out, `+` for income, no sign on transfers, `±` on adjustments. Formatted with
  `Intl.NumberFormat(locale, { currency })`, with no decimals where the currency has no minor unit
  (COP, JPY…). **How many decimals a currency has is the app's answer (`lib/format/currency.ts`),
  never the device's.**
- **Space:** a grid of 4 (`--sp-1…16`). Page padding 16 on mobile, 24 on tablet, 32 on desktop.
  Sections are 20 or 24 apart.
- **Radii:** 6 sm (badges, kbd) · 10 md (buttons, fields, nav links) · 14 lg (cards) · 20 xl (modals)
  · 28 2xl (bottom sheet) · a circle for the FAB, the avatar and the swatch.
- **Controls:** 32 sm · 40 md · 48 lg (fields and the save button) · 44 minimum touch target.
- **Elevation:** in light, shadow 1 for cards, 2 for the FAB and menus, 3 for sheets. In dark,
  elevation is a border plus a lighter surface, with no shadow except on the sheet.
- **Motion:** 120ms for micro-interactions (hover, chips), 200ms for transitions, 320ms for progress
  and sheets; curve `cubic-bezier(.2,0,0,1)`; all of it zero under `prefers-reduced-motion`. **All
  means all, the button's loading spinner included:** when the system asks for less motion nothing
  spins, and so the button is not left with a broken arc — which no longer reads as "waiting" — **the
  ring is drawn whole and still**. The button still says what it is doing through `aria-busy` and by
  being disabled.
