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

W-18 adds the full form model in `form.ts`: one Zod schema for the four types (the account side
rules live in `superRefine`), `toTransactionInput` maps the form to the API payload (explicit
nulls so PUT can clear a side), `fromTransaction` prefills the edit form and `draftFromSearchParams`
reads the quick-add hand-off. `useCreateTransaction`, `useUpdateTransaction`, `useTransactionQuery`
and `useTagsQuery` back the screens in `app/[locale]/(app)/transactions/`.

W-19 adds the list: `filters.ts` parses and serializes the URL filters (period presets, type,
account, category, tag, pending, quick-only, search) and maps them to the API query;
`useTransactionsInfinite` pages by cursor, `usePeriodTotals` turns the server's day buckets into
the summary and the day headers, `groups.ts` only cuts the sorted rows where the local day changes.
The screen and the filters sheet live in `app/[locale]/(app)/transactions/`.
