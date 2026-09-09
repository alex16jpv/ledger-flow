# Colour

## Three layers

| Layer      | File                        | What it defines                                                                                                                                         | Who touches it  |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Seeds      | `tokens/palette.<name>.css` | 18 OKLCH colours: `--seed-neutral`, `--seed-brand`, 16 `--seed-<token>`; aliases `--seed-positive/negative/warning/info`                                | Palette author  |
| Semantic   | `tokens/semantic.css`       | Surfaces, text, brand, money flows, states, and the four roles of every feature token. Light and dark with `light-dark()`, derived with `oklch(from …)` | Nobody (stable) |
| Components | `ui.css` / Tailwind         | Only consume semantic tokens                                                                                                                            | The app         |

**Why OKLCH and derivation:** a new palette only picks hues. The lightness of each role is fixed —
soft background 0.95 in light and 0.26 in dark, text 0.42 and 0.82 — so contrast is guaranteed by
construction and dark mode needs no extra colour. It is the Radix Colors / Tailwind v4 pattern moved
into variables.

## Semantic tokens

| Token                                                                                    | Use                                                                                                               |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--bg`                                                                                   | page background                                                                                                   |
| `--surface`                                                                              | cards, sheets, sidebar                                                                                            |
| `--surface-2`                                                                            | fields, inactive chips, progress tracks, row hover                                                                |
| `--surface-3`                                                                            | hover over surface-2, progress tracks                                                                             |
| `--border` / `--border-strong`                                                           | separators / control borders                                                                                      |
| `--text` / `--text-2` / `--text-3`                                                       | primary / secondary (metadata) / tertiary (placeholders, eyebrows). All three meet AA over `--bg` and `--surface` |
| `--ink` / `--on-ink`                                                                     | selected chips, toasts (maximum contrast)                                                                         |
| `--brand`, `--brand-hover`, `--on-brand`, `--brand-soft`, `--brand-text`, `--focus-ring` | primary action, FAB, active navigation, links, focus                                                              |
| `--income`, `--income-soft`                                                              | income                                                                                                            |
| `--expense`                                                                              | = `--text` (no colour)                                                                                            |
| `--transfer`, `--transfer-soft`                                                          | transfers                                                                                                         |
| `--adjustment`                                                                           | = `--text-2`                                                                                                      |
| `--danger*`, `--warning*`, `--success*`, `--info*`                                       | states                                                                                                            |
| `--c-<token>`, `-soft`, `-text`, `-border`                                               | feature colour (16 × 4)                                                                                           |

## The 16 feature colours

Roles per token: **solid** (dots, progress fills, an account's stripe), **soft** (tile background and
selected chip), **text** (icon and text over soft or over surface), and **border**. The rule is
**never text on the solid**: the light hues — yellow, lime, amber, cyan, teal — do not reach 3:1 over
white as a solid, which is why the solid is always decorative and always comes with an icon or a
label.

The token's name fixes the **hue family**: in any palette `RED` reads as red. A palette may vary
saturation and lightness, never identity. `GRAY`, `BROWN` and `BLACK` are tinted neutrals; `BLACK`
rises to L ≥ 0.52 in dark mode so it stays visible.

## Colour picker (`swatch`)

A grid of 16 circles of 28px showing each token's solid, a 2px `--text` ring on the selected one,
`aria-pressed`, and the token's name as `aria-label`. A live preview of the tile with the chosen icon
sits next to the picker. The same component serves account, category and budget.

## Adding a palette

1. Copy `palette.tinta.css` to `palette.<name>.css`, change the selector to
   `:root[data-palette="<name>"]` and the 18 seeds. Constraints: `--seed-brand` with L ≤ 0.50; feature
   seeds with L between 0.28 and 0.85, respecting the hue family.
2. `node tools/contrast-check.mjs tokens/palette.<name>.css` must end clean. Decorative solids of the
   light hues may fail; nothing else may.
3. Import it in the global CSS and add it to the palette list in Settings › Appearance.
   `palette.brisa.css` is the demonstration of the process, not a delivered palette.
