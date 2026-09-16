# Accessibility and quality

- AA contrast verified for text in both modes (`tools/contrast-check.mjs`); 3:1 on controls and focus.
  **The solid of a feature colour is exempt**: it is decorative by definition (never text on the
  solid) and never appears alone — an icon, a label or the row's name always comes with it, and those
  do comply. The check reports it as `info` and does not fail; the Brisa palette has five such cases
  in light mode (amber, yellow, lime, teal and cyan).
- Every control has an accessible name; `aria-pressed` on chips, segments and swatches; `aria-current`
  on navigation; sheets are `role="dialog"` with focus trapped and returned.
- **A loading state carries a role, not a bare label.** Every skeleton that stands in for a screen or
  a card is `role="status"` with `aria-busy="true"` and the name "Loading": on a `div` with no role,
  `aria-label` is prohibited ARIA and a reader gets **nothing at all** (axe `aria-prohibited-attr`).
  `no-restricted-syntax` in `eslint.config.mjs` fails on any that is missing it. What this buys is the
  name — a reader that reaches the region hears "Loading". It is **not** an announcement: `Skeleton` is
  `aria-hidden`, so the live region has no text to announce and nothing is read out on its own.
- Keyboard: a logical order, `Enter` saves in quick capture, `Esc` closes sheets.
- **A chart is one tab stop, not one per slot.** Thirty bars would be thirty stops between the period
  and the rest of the page, so the charts that have slots (components 18, 30, 32, 33) use the roving `tabindex`
  pattern: the chart takes focus once, the arrows move between slots — inside the calendar, up and
  down move a week — `Home` and `End` jump to the ends, and `Enter` opens what the slot leads to. The
  focused slot shows its bubble and drives the `readout`, so the keyboard and the pointer read the
  same line. **A tap is not an activation** (T-80): where the pointer cannot hover, `(hover: none)`, a
  tap only takes the slot's focus and raises its reading, because it is the only reading a finger has —
  `Enter` still opens, so the slot is never a control that does nothing. **A line chart has no slots to
  focus** and is read by sliding a finger along it (T-81); what a reader and a keyboard get there is the
  card's own sentence, which is the whole reading and not a headline, which is why the positions were
  never made controls. A chart whose slots lead nowhere is not a set of controls at all: it is one `role="img"`
  whose accessible name reads every slot, not only the headline, and a line chart has no slots at all —
  its reading lives in the sentence and the `readout` beside it. Days that have not happened are neither, and are
  hidden from readers in every chart that shows them.
- Font size respects the system zoom (rem); no text inside images.
- **Zoom stays in the browser and is fixed in the installed app.** The document is served scalable,
  so pinch and text zoom work wherever the app is a page (WCAG 1.4.4 · axe `meta-viewport`); the head
  script fixes the scale only under `display-mode: standalone`, where the window is the app's own
  chrome and a stray pinch leaves a layout the user cannot reset from inside it. iOS honours that in
  the installed app only — Safari as a browser ignores `user-scalable` by design.
- Perceived performance: skeletons in lists, optimistic create and edit with a rollback on error.
