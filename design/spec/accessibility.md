# Accessibility and quality

- AA contrast verified for text in both modes (`tools/contrast-check.mjs`); 3:1 on controls and focus.
  **The solid of a feature colour is exempt**: it is decorative by definition (never text on the
  solid) and never appears alone — an icon, a label or the row's name always comes with it, and those
  do comply. The check reports it as `info` and does not fail; the Brisa palette has five such cases
  in light mode (amber, yellow, lime, teal and cyan).
- Every control has an accessible name; `aria-pressed` on chips, segments and swatches; `aria-current`
  on navigation; sheets are `role="dialog"` with focus trapped and returned.
- Keyboard: a logical order, `Enter` saves in quick capture, `Esc` closes sheets.
- Font size respects the system zoom (rem); no text inside images.
- Perceived performance: skeletons in lists, optimistic create and edit with a rollback on error.
