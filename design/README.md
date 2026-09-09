# Design

The UI of Ledger Flow: the preview pages the owner reviews, and the tool that writes them.

```
build.mjs        writes preview/*.html (the pages are the deliverable, this is the tool)
build-icons.mjs  rebuilds preview/assets/icons.js from lucide-static; icons.txt is the curated list
serve.mjs        serves preview/ over http (the pages also open straight from disk)
shoot.mjs        screenshots every page into captures/ with Playwright
preview/         the pages, plus assets/ (ui.css, shell.css, shell.js, icons.js, fonts)
captures/        generated, not versioned
```

## Commands

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run design`       | Builds the pages and serves them at http://localhost:3005             |
| `npm run design:build` | Writes `preview/*.html`                                               |
| `npm run design:shoot` | Screenshots every page, both devices and both modes, into `captures/` |

`design:shoot` takes filters: `node design/shoot.mjs --page=05 --device=mobile --mode=dark`.

The pages read the repo's `tokens/`, so a color only exists in one place. `npm run check-tokens`
and `npm run contrast-check` guard it.

Captures are not versioned: they are 14 MB of PNG that go stale the moment a page changes.
Regenerate them with `npm run design:shoot`.
