# Public surface

`preview/public.html`

- **The public frame:** a header with the brand — the logo and the name from 600px up; below, the logo
  alone, with the name kept for screen readers, because the name, the language chip and both buttons
  do not fit in 360px (Spanish needs 422) — links (Features, How it works, Privacy) visible at 600px
  and up, pointing at the landing's sections from any public page, the language chip, a ghost "Sign in" and a primary "Get started"; a footer with the ©,
  the legal links (Privacy policy, Terms, Data processing Ley 1581, Contact) and the language switch,
  which, like the chip, leads to the same page in the other language.
  No sidebar and no tab bar. Rendered on the server — per request, not prerendered, because of the CSP
  nonce (P-41) — so search engines read it without JavaScript.
- **Landing** (`#landing`): a two-column hero at 900px and up (the text, and a phone showing the real
  Home screen rather than a picture), a "Free · no card needed" badge, a single h1, the value paragraph
  — which names the three habits the product is for: capturing, budgeting and splitting what is shared
  — a primary call to action to sign up and a secondary one to sign in, and a line of reassurance
  (offline, installable, bilingual, your data stays yours). Then four sections, each an `h2` under an
  eyebrow:
  - **Why** (`#features`) opens with a lede under its `h2` — one paragraph, centred, 62ch — and then
    **six cards** built from the system's tiles, one per thing the app does today: three-second capture
    (with the suggestions and the review inbox), budgets that talk back (any period, overall or per
    category), shared expenses, stats and trends, every account type, and works without signal (with
    installing it). Three columns at 900px and up, two from 600px, one below. The lede is the page's only
    plain definition of what Ledger Flow is: it names the product in the words a person would type into
    a search box (free expense tracker, budget app, personal finance, split bills) and repeats the nouns
    the `h1` uses, because the `h1` alone says them once and a page whose copy never uses its own heading
    words is a page that ranks for nothing.
  - **Shared expenses** (`#shared`): the one feature with a section of its own, because it is the one a
    visitor would not guess from "expense tracker". Two columns at 900px and up — the text, and a card
    showing the real **People** face of Shared (the two figures, who owes you and who you owe, with
    their shared groups) with fixed sample people — stacked below. The text is a paragraph and four
    checked lines: the four ways to split, what each person owes you across every group, getting paid in parts or in cash without it counting as income, and adding anyone by name — nobody needs an account — with an invitation, by the email of their account, for whoever uses Ledger Flow too. Nothing is emailed, so the copy never says "by email" as if it were.
  - **How it works** (`#how`): three numbered steps and a call to action.
  - **Questions** (`#faq`): six questions a visitor asks before signing up — is it free, does it
    connect to my bank, does it work offline, do the people I split with need an account, phone and
    computer, who sees my data — each an `h3` with its answer visible, never folded: a closed accordion
    hides the answer from whoever skims and says nothing a crawler can rank. A 720px column.

  Nothing on the page promises what the app does not do yet (export, import, notifications,
  recurring): the landing is updated when those ship, not before. The copy carries the landing past
  600 words in both languages. Semantics: one `h1`, an `h2` per section, `section` with
  `aria-labelledby`. The two mocks are `role="img"` with a label, so a screen reader hears one
  sentence instead of sample figures. Metadata: a title of 60 characters at most, a description of 155 at
  most, Open Graph with a generated OG image, a canonical, `hreflang` en/es, and JSON-LD `Organization`, `WebSite`, `WebApplication` and a `FAQPage` built from the same messages as the visible questions. `/login` is `noindex, follow` and stays out of the sitemap; `/register` is indexed with its own description. The language switch in the footer points the current
  language at the plain path: a link that only redirects back to the page it sits on is a link a
  crawler follows for nothing.

- **Legal** (`#privacy-policy`, `#terms`): a 720px column, an eyebrow with the date of the last update,
  an `h1` and `h2` sections. The privacy policy has: who is responsible, what we store, who sees what,
  why we use it, who helps us run it, cookies and your device, how long we keep it, your rights,
  security, changes, data processing (Ley 1581) and contact. It describes the data by **kind** — the account and its
  settings, what you record, shared expenses, and the technical data the service needs (devices, the IP against abuse, the
  emails sent) — and keeps by kind too: while the account lives, 30 days after deleting it, and technical data no more than
  30 days, except the addresses that reject our email. It never lists fields one by one, nor how passwords, limits or
  fingerprints work inside, nor each cookie's lifetime: those change with the code, and a policy is about kinds and purposes
  (the owner's decision of 2026-10-05, T-259). It still names every company that processes data with what it does and
  where (the data is kept in the United States), because the law asks who receives the data. A policy that forgets a kind
  of data, a feature or a provider is wrong about it. The controller is **alexpiral**, the brand that runs Ledger Flow, reached at
  `ledgerflow@alexpiral.com`: no personal data of the owner is published (the owner's decision of 2026-10-03).
  The policy is written for anyone anywhere and names only Colombian law, because the app is not aimed
  at any country. Turnstile's privacy addendum is linked, as Cloudflare requires for its invisible mode.
  Terms (the service, your account, sharing with other people, acceptable use, availability, changes,
  contact) link the policy from their intro. The plates shorten the long lines; the copy is in
  `messages/*.json` (`public.privacy`, `public.terms`).
- **404** (`#not-found`): an `Empty` with a `search` tile, a title, a reassuring line ("Your money is
  where you left it"), a call to action to Home and "Back". Home is `/`, not `/home`: the proxy already sends a device that
  carries the session marker from `/` to the app, and a visitor lands on the landing instead of on a
  sign-in wall. It returns a real 404. A 500 and a network
  error use the same composition with a `circle-alert` tile. **The title is the page's `h1`**, at the
  page title's size (24): the `Empty` is the whole page here, so nothing else carries the document's
  first heading.
