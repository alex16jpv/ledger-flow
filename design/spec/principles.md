# Principles

- **The number leads.** The app exists to show the small daily spending: every screen has one
  headline amount and the rest serves it. Tabular figures always; hierarchy by size and weight, never
  by colour.
- **Capture in three seconds.** The centre button is always visible and opens quick capture; the
  amount comes first and is the only required field. Everything else is optional and can be completed
  later, from the review inbox.
- **Colour is data.** The interface is neutral — warm greys and a discreet brand accent. Colour shows
  up where it means something: the user's colour on accounts, categories and budgets; green for
  income; red only for danger or overspending; amber for pending or a warning. Spending is not
  painted red: it is the base case.
- **No surprises from a financial system.** Nothing is deleted, it is archived. Every action with a
  side effect — changing the main account, changing a budget's period, archiving a category that has
  budgets — is announced before and confirmed after, with an undo wherever the backend allows one.
- **One rule, every surface.** One row component, one icon tile, one chip, one picker: the same in
  transactions, accounts, categories and budgets.
- **Accessible by default.** AA on every text/background pair (checked by `tools/contrast-check.mjs`),
  touch targets of 44px or more, visible focus, `prefers-reduced-motion` respected, and no information
  carried by colour alone.
