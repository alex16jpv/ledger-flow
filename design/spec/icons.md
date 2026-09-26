# Iconography

## Rules

Lucide, 20px base (16 in chips and badges, 24 in large tiles), 1.75 stroke inheriting `currentColor`.
Interface icons always come with a visible label or an `aria-label`.

## Interface icons (fixed)

Home `house` · Transactions `list` · Budgets `chart-pie` · Accounts `wallet` · Stats `chart-column` ·
Categories `tags` · Shared `users` · Settings `settings` · Add `plus` · To review `inbox` · Search `search` · Filters
`sliders-horizontal` · Archive `archive` · Restore `archive-restore` · Edit `pencil` · Main account
`star` · Transfer `repeat` / `arrow-left-right` · Balance adjustment `scale` · Income `trending-up` ·
Expense `trending-down` · Tag `tag` · Note `notebook-pen` · Date `calendar` · Time `clock` · Sessions
`smartphone`/`monitor` · Appearance `palette` · Mode `sun`/`moon` · Sign out `log-out` · Warning
`triangle-alert` · Error `circle-alert` · Success `circle-check` · Info `info` · Uncategorized `hash` ·
Email `mail` · Email confirmed `mail-check` · Account removed `user-x` · Undo `undo-2`.

## Curated set for categories (the key is `Category.icon`)

The backend stores the key: the `CATEGORY_ICONS` enum in `src/shared/icons.ts`, with `emoji` removed and
the seeded categories carrying their icon.

`house utensils car zap shopping-bag briefcase coins circle-plus repeat credit-card coffee stethoscope
dog cat pizza shopping-cart bus fuel plane train-front bike pill dumbbell graduation-cap book-open
gamepad-2 music film tv wifi phone droplets flame lightbulb shirt scissors baby wrench hammer
paint-bucket sofa bed key shield umbrella hand-coins percent gift heart star trophy sprout leaf beer
wine cake ice-cream-cone apple carrot croissant sandwich ticket popcorn headphones camera laptop bath
washing-machine trees mountain tent ship glasses watch gem crown medal paintbrush footprints cookie
martini church store shopping-basket package truck plug battery radio speaker piggy-bank landmark
banknote wallet receipt calculator scale target layers building-2 trending-up trending-down
arrow-left-right tag hash`

Seeded categories (`seedKey` → icon): salary `briefcase` · business `coins` · other-income
`circle-plus` · housing `house` · food `utensils` · transportation `car` · bills-services `zap` ·
lifestyle `shopping-bag` · transfer `repeat` · credit-card-payment `credit-card`.

Account type icons (fixed by `type`, not chosen by the user): CASH `banknote` · ACCOUNT `landmark` ·
CARD `credit-card` · DEBIT_CARD `wallet-cards` · SAVINGS `piggy-bank` · INVESTMENT `trending-up` ·
OVERDRAFT `circle-alert` · LOAN `hand-coins` · OTHER `wallet`. The account's colour is the user's.
