# Categories

`preview/categories.html`

## Grid (`#grid`)

A segmented control per type with counts; tiles in three columns (an lg tinted icon, the name, and "n
txns" or "unused"); a dashed "New category" card; a folded "Archived (n)" section (`includeArchived`,
at 60%, with a Restore action that handles a 409); and an alert whose "Restore" recreates the defaults
(`POST /categories/restore-defaults`) with the toast "n categories created" or "None were missing".

**With no connection the button is hidden** (`#offline`) — a dead control does not help — and the alert
adds "Needs a connection: the server creates these categories." It is the only category write that does
not go through the queue, because the server mints the ids. A 409 while restoring an archived one opens
the same rename sheet the accounts use.

## New and edit (`#edit-with-locked-type`)

A live preview (lg tile plus name plus type), the name, the type as a segmented control (locked once
there is history: the segment sits at 60% without interaction, with a `CATEGORY_TYPE_LOCKED` alert and
a link to create a new category), the icon (searched by keyword over the curated set, in a grid of 40px
tiles, the selected one tinted with a ring) and the colour (swatches). "Archive category" is the
secondary action in the footer, with a confirmation.
