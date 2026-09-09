# Design

The UI of Ledger Flow: the preview pages the owner reviews, and the tool that writes them.

```
build.mjs        writes preview/*.html from the page model at the bottom of the file
build-icons.mjs  rebuilds preview/assets/icons.js from lucide-static; icons.txt is the curated list
serve.mjs        serves preview/ over http (the pages also open straight from disk)
shoot.mjs        screenshots every page into captures/ with Playwright
preview/         the pages, plus assets/ (ui.css, shell.css, shell.js, icons.js, plates.js, fonts)
captures/        generated, not versioned
```

## Commands

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run design`       | Builds the pages and serves them at http://localhost:3005             |
| `npm run design:build` | Writes `preview/*.html`                                               |
| `npm run design:shoot` | Screenshots every page, both devices and both modes, into `captures/` |

`design:shoot` takes filters: `node design/shoot.mjs --page=settings --device=mobile --mode=dark`.

The pages read the repo's `tokens/`, so a colour only exists in one place. `npm run check-tokens`
and `npm run contrast-check` guard it. Captures are not versioned: they are megabytes of PNG that go
stale the moment a page changes.

## How the preview is organised

One **plate** is one mockup: a named screen or state, with its own anchor. Plates live on **pages**,
pages belong to **groups**, and the sidebar is the map. Every plate carries the date it arrived, so
`changes.html` can list what is new and the sidebar can flag it.

| Group       | Pages                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| —           | `index` (start here), `in-review`, `changes`                                                                       |
| Foundations | `foundations`                                                                                                      |
| Screens     | `home` `add` `access` `transactions` `accounts` `categories` `budgets` `budget-detail` `stats` `settings` `public` |
| States      | `states` `sync-stripes` `conflicts` `attention-tray` `local-mode`                                                  |
| Decisions   | `variants`                                                                                                         |

**`in-review.html` is the queue.** A design being worked on gets `review: true` in the page model:
it then shows up only there, never on its own page, until the owner approves it. Approving means
dropping the flag — the plate moves to the page it belongs to and the queue empties again.

To add a plate, add one `plate(id, title, note, html, { added })` to a page in `build.mjs`. The id is
the anchor and the search key, so it says what the thing is: `three-exits`, not a ticket number.

## Where the old plate letters went

Documents written before 2026-09-09 name plates by letter (`preview P`, `lámina B`). This is where
each one lives now.

| Old             | Now                                      | Old               | Now                                                                                                                                                                |
| --------------- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01-inicio` A   | `home#home`                              | `11-estados` J    | `attention-tray#tray`                                                                                                                                              |
| `01-inicio` B   | `home#install-card`                      | `11-estados` J2   | `attention-tray#discard-all`                                                                                                                                       |
| `11-estados` T  | `home#home-without-a-name`               | `11-estados` J3   | `attention-tray#empty-tray`                                                                                                                                        |
| `11-estados` A  | `states#empty-list`                      | `11-estados` J4   | `attention-tray#restore-with-another-name`                                                                                                                         |
| `11-estados` B  | `states#loading-list`                    | `11-estados` J5   | `attention-tray#blocked-by-an-update`                                                                                                                              |
| `11-estados` C  | `states#server-error`                    | `11-estados` L    | `local-mode#sign-in-to-sync`                                                                                                                                       |
| `11-estados` D  | `states#session-expired`                 | `11-estados` M    | `local-mode#projected-figures`                                                                                                                                     |
| `11-estados` E  | `states#archive-confirmation`            | `11-estados` N    | `local-mode#offline-document`                                                                                                                                      |
| `11-estados` O  | `states#new-version`                     | `11-estados` S    | `local-mode#three-exits`                                                                                                                                           |
| `11-estados` F  | `sync-stripes#offline`                   | `11-estados` S2   | `local-mode#delete-local-copy`                                                                                                                                     |
| `11-estados` G  | `sync-stripes#back-online`               | `10-ajustes` A–F  | `settings#settings-hub` `#appearance` `#active-sessions` `#profile-and-security` `#delete-account` `#language`                                                     |
| `11-estados` H  | `sync-stripes#needs-attention`           | `10-ajustes` G–K  | `settings#sync-status` `#sync-status-installed` `#sync-status-one-at-a-time` `#sync-status-resync` `#sync-status-offline`                                          |
| `11-estados` K  | `sync-stripes#waiting-with-a-connection` | `10-ajustes` L–N  | `settings#sign-out-with-unsent-changes` `#settings-offline` `#language-offline`                                                                                    |
| `11-estados` P  | `sync-stripes#signed-out`                | `10-ajustes` O–Q  | `settings#sync-status-signed-out` `#sync-status-preparing` `#sync-status-blocked-queue`                                                                            |
| `11-estados` Q  | `sync-stripes#ready-for-offline`         | `10-ajustes` R–T  | `settings#sync-status-loading` `#sync-status-no-service-worker` `#sync-status-this-device-only`                                                                    |
| `11-estados` R  | `sync-stripes#blocked-by-an-update`      | `10-ajustes` U–V  | `settings#install-sheet` `#install-sheet-steps`                                                                                                                    |
| `11-estados` S3 | `sync-stripes#this-device-only`          | `11-estados` I–I7 | `conflicts#changed-in-two-places` `#refused-by-the-server` `#account-archived-elsewhere` `#server-did-not-say` `#nothing-to-resolve` `#name-taken` `#fix-the-date` |

The other pages kept their plates and only changed file name: `00-fundamentos` → `foundations`,
`02-registrar` → `add`, `03-presupuestos` → `budgets`, `04-acceso` → `access`, `05-movimientos` →
`transactions`, `06-cuentas` → `accounts`, `07-categorias` → `categories`, `08-presupuesto-detalle` →
`budget-detail`, `09-estadisticas` → `stats`, `12-publico` → `public`, `13-variaciones` → `variants`.
