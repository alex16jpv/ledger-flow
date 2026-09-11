# The specification

What the UI of Ledger Flow is, and why. Every screen lives in one file, and every file has a page of
the preview next to it: `screens/settings.md` is `preview/settings.html`. Nothing reaches the app
without being here first (D-36).

## Foundations

| File                                 | What it settles                                                     |
| ------------------------------------ | ------------------------------------------------------------------- |
| [principles.md](principles.md)       | The six rules the rest obeys                                        |
| [color.md](color.md)                 | The three layers of colour, the 16 feature tokens, adding a palette |
| [typography.md](typography.md)       | Type scale, spacing, radii, controls, elevation, motion             |
| [icons.md](icons.md)                 | Lucide, the fixed interface icons and the curated category set      |
| [app-map.md](app-map.md)             | Every screen against the backend, with its state                    |
| [layout.md](layout.md)               | Tab bar, sidebar, breakpoints, page header                          |
| [components.md](components.md)       | The 33 components and how they behave                               |
| [accessibility.md](accessibility.md) | Contrast, keyboard, names, perceived performance                    |
| [decisions.md](decisions.md)         | Every decision with its date and its reason                         |

## Screens

| File                                                   | Preview               |
| ------------------------------------------------------ | --------------------- |
| [screens/home.md](screens/home.md)                     | `home.html`           |
| [screens/add.md](screens/add.md)                       | `add.html`            |
| [screens/access.md](screens/access.md)                 | `access.html`         |
| [screens/transactions.md](screens/transactions.md)     | `transactions.html`   |
| [screens/accounts.md](screens/accounts.md)             | `accounts.html`       |
| [screens/categories.md](screens/categories.md)         | `categories.html`     |
| [screens/budgets.md](screens/budgets.md)               | `budgets.html`        |
| [screens/budget-detail.md](screens/budget-detail.md)   | `budget-detail.html`  |
| [screens/stats.md](screens/stats.md)                   | `stats.html`          |
| [screens/trends.md](screens/trends.md)                 | `trends.html`         |
| [screens/settings.md](screens/settings.md)             | `settings.html`       |
| [screens/public.md](screens/public.md)                 | `public.html`         |
| [screens/states.md](screens/states.md)                 | `states.html`         |
| [screens/sync-stripes.md](screens/sync-stripes.md)     | `sync-stripes.html`   |
| [screens/conflicts.md](screens/conflicts.md)           | `conflicts.html`      |
| [screens/attention-tray.md](screens/attention-tray.md) | `attention-tray.html` |
| [screens/local-mode.md](screens/local-mode.md)         | `local-mode.html`     |

## How to consume this design

1. **Tokens are code.** `tokens/*.css` is imported by the app's global CSS in this order: palettes →
   `semantic.css` → `base.css` → `tailwind.theme.css` (that file carries the snippet). From then on
   there are utilities like `bg-surface`, `text-text-2`, `border-border`, `bg-brand`, `text-income`,
   `bg-c-red-soft`, `text-c-red-text`, `rounded-lg` (= `--r-lg`). **Never** a hex, never a
   `bg-red-500`: every colour goes through a token.
2. **Components.** `preview/assets/ui.css` is the reference for each component — sizes, radii,
   states. Each block becomes a React component with Tailwind utilities over the same tokens. The
   class names in `ui.css` are this specification's vocabulary (`.row`, `.tile`, `.chip.cat`,
   `.sheet`…).
3. **Feature colour.** The backend returns a token (`RED`…`BLACK`). The app puts `.color-<TOKEN>` on
   the container (or sets `--f`, `--f-soft`, `--f-text`, `--f-border`) and the children read
   `var(--f*)`. There is no token→class table per surface: one rule for accounts, categories and
   budgets.
4. **Mode and palette.** `<html data-palette="tinta" data-mode="light|dark">`; without `data-mode` it
   follows the system. The choice persists in `localStorage` and, when it exists, in the profile.
   Adding a palette is one `palette.<name>.css` file plus its entry in the Appearance picker.
5. **Icons.** Lucide (`lucide-react`), 1.75 stroke (2 at 16px). A category's icon is a Lucide key
   stored in `Category.icon`; categories without one show `hash`.
6. **Language.** The UI is bilingual from birth: **English by default**, Spanish second (`en`, `es`).
   No string is embedded in a component: everything goes through `messages/<locale>.json` with stable
   keys. Money, dates, plurals and lists are formatted with `Intl` using a **format locale** derived
   from the language (`es` → `es-CO`, `en` → `en-US`, respecting the device's region when it shares
   the language) and the user's `currency` and `timezone`: COP reads `$1,284,300` in `en-US` and
   `$ 1.284.300` in `es-CO`. The choice persists in `localStorage` and in the profile (`user.locale`: `en|es`, default `en`). The language resolves on the server (URL → cookie → `Accept-Language`)
   so the first render is already right. Spanish runs about 20% longer: no component fixes a width to
   its text — chips and buttons grow, titles truncate.
7. **Layout.** A full-height app shell: `main` is the only scrolling region, the tab bar is fixed at
   the bottom below 900px and the sidebar is fixed at 900px and up.
