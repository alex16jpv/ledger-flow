# Transactions

Everything about money movements: quick capture, the full form, the list, the detail and the
pending inbox. F1 exposed only the pending count that the shell shows next to Transactions.

W-17 adds quick capture: `useQuickAdd` posts to `POST /transactions/quick` with the sheet's
`Idempotency-Key`, then adds the optional note with a `PUT` (clearing `pendingDetails` when a category
was chosen too) and invalidates every money domain (`lib/query/domains.ts`). `useDeleteTransaction`
backs the toast's Undo. The sheet itself is composed in the app layer
(`app/[locale]/(app)/QuickAddSheet.tsx`) because it needs the category and account pickers of other
features; `draftToSearchParams` carries what was typed to the full form when the user asks for
"More details".
