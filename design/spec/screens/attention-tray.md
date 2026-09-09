# Attention tray

`preview/attention-tray.html` · route `/sync`

- **The screen** (`#tray`) has a back button, the title "Needs your attention" (or "n changes need
  you"), the intro "These changes are saved on this device and the server has not taken them. Nothing
  else in the queue is waiting for them." and, when there is more than one, the bulk actions "Discard
  all" and "Try all again" as secondaries.
- **One card per stuck change**, in queue order: the row's tile and name (or "This {what}" when it has
  none), a `danger` badge with the class of problem — "Changed in two places", "Refused by the server",
  "Account archived" — a sentence saying what this device asked for ("This device asked to create /
  capture / edit / delete / archive / restore this {what}.", "…make this account the default.", "…change
  or remove this budget's amount for one period."), the reason in plain language, and the ways out:
  - a conflict → "Keep this device's version" (primary), "Use the server's version" (ghost) and
    "Compare versions", which opens the conflict sheet;
  - a refusal → "Try again" and "Discard this change";
  - an archived account → "Restore the account" (primary) and "Discard this change";
  - **an impossible date** → **"Fix the date"** (primary, opening the conflict sheet), "Discard this
    change", and "Try again" last; the card's reason is concrete: "Its date, Sep 25 · 18:10, is more
    than 24 hours ahead of the server's time. This device's clock is 3 days ahead.";
  - **a name taken** (`#restore-with-another-name`) → a `danger` badge "Name taken", the reason "An
    active account is already named “Cash”, so the server won't take this one back. Restore it with
    another name, or discard the change.", and the ways out **"Restore with another name"** (primary,
    opening the embedded rename sheet), "Compare versions" and "Discard this change". No "Try again",
    for the same reason.
- **Changes blocked by an app update** (`#blocked-by-an-update`): they land in the same tray with the
  `danger` badge "Blocked by an app update", headed by a `danger` alert — "**n changes can't be sent
  after an app update.** Everything you record from now on syncs normally; these n were recorded with an
  older version and stayed behind. Discarding them frees the queue." — and the bulk action "Discard the
  n changes". Each card's reason is honest: "It was recorded with an older version of the app and this
  version can't send it. It will never reach the server on its own." There is no retry, so the ways out
  are **"Discard this change"** (primary) and "Keep it here" (ghost: it stays on the device in case a
  future version knows how to migrate it).

  **What "Keep it here" does:** nothing to the change — that is its promise — so the card turns into the
  line "Kept on this device." and drops its two buttons for that visit, to stop asking what has already
  been answered. The operation stays in the queue, and the alert and the stripe keep counting it,
  because it is still there. The footer reads "Nothing you record now waits behind these."

- **Discard confirmation** (`#discard-all`): the sheet "Discard n changes?" with a `warning` alert,
  "They will never reach the server, and this device goes back to what the server has.", and, where it
  applies, "k of them were made on top of something created here and go with them." — discarding a
  creation drags whatever depended on it. The call to action is a solid `danger` "Discard". Toasts: "n
  changes discarded" and "n changes back in the queue".
- **Empty** (`#empty-tray`): a green `cloud-check` tile, "Nothing needs you", "Every change on this
  device either synced or is still on its way.", and "Go home". **Loading:** "Reading what's waiting…".
  **A read error:** the empty state with a retry.
- It is reached from "See all" on the red stripe, from Settings › Sync status ("Changes that need you")
  and from the stripe itself while anything is stuck. It never blocks the rest of the queue.
