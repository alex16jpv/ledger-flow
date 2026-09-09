# Public surface

`preview/public.html`

- **The public frame:** a header with the brand, links (Features, How it works, Privacy) visible at
  600px and up, the language chip, a ghost "Sign in" and a primary "Get started"; a footer with the ©,
  the legal links (Privacy policy, Terms, Data processing Ley 1581, Contact) and the language switch.
  No sidebar and no tab bar. Rendered on the server, statically, so search engines read it without
  JavaScript.
- **Landing** (`#landing`): a two-column hero at 900px and up (the text, and a phone showing the real
  Home screen rather than a picture), a "Free · no card needed" badge, a single h1, the value paragraph,
  a primary call to action to sign up and a secondary one to sign in, and a line of reassurance
  (offline, bilingual, your data stays yours). A "Why" section with three cards — three-second capture,
  budgets that talk back, works without signal — built from the system's tiles. A "How it works" section
  with three numbered steps and a final call to action. Semantics: one `h1`, an `h2` per section,
  `section` with `aria-labelledby`. Metadata: a title of 60 characters at most, a description of 155 at
  most, Open Graph with a generated OG image, a canonical, `hreflang` en/es, and JSON-LD
  `SoftwareApplication` plus `Organization`.
- **Legal** (`#privacy-policy`): a 720px column, an eyebrow with the date of the last update, an `h1`
  and `h2` sections (what we store, why, your rights, contact). The privacy policy doubles as the data
  processing policy under Ley 1581: purpose, the rights of access, correction and erasure, the contact
  channel (`ledgerflow@alexpiral.com`) and the response time. Terms use the same template.
- **404** (`#not-found`): an `Empty` with a `search` tile, a title, a reassuring line ("Your money is
  where you left it"), a call to action to Home and "Back". It returns a real 404. A 500 and a network
  error use the same composition with a `circle-alert` tile.
