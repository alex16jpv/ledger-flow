import { fromCents, toCents } from "@/lib/local/derive/money";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { AddParticipantsPreview, Contact } from "@/types/api";

import type { GroupView } from "./ledger";

export interface PreviewRow {
  key: string;
  contactId: string | null;
  name: string;
  color: ColorToken | null;
  shareAfter: number;
  paid: number;
  // What they would be over their new share, which is their money in your account.
  ahead: number;
  // A share that falls takes the write-off down with it: nobody was owed what is no longer theirs.
  writtenOffBefore: number | null;
  writtenOffAfter: number;
  state: "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";
}

export const USER_ROW = "user";

export function previewRows(
  view: GroupView,
  preview: AddParticipantsPreview,
  picked: readonly Contact[],
): PreviewRow[] {
  return preview.participants.map((one) => {
    const person = view.people.find((party) => party.contactId === one.contactId);
    const chosen = picked.find((party) => party.id === one.contactId);
    const paid = person?.paid ?? 0;
    const ahead = toCents(paid) - toCents(one.shareAfter);
    const off = view.group.writeOffs.find(
      (entry) => entry.contactId === one.contactId && entry.expenseId === null,
    );
    // What is given up is what was open when you decided, capped again by what is open now.
    const openNow = Math.max(0, -ahead);
    return {
      key: one.contactId ?? USER_ROW,
      contactId: one.contactId,
      name: person?.name ?? chosen?.name ?? "",
      color: one.contactId === null ? null : (person?.color ?? chosen?.color ?? null),
      shareAfter: one.shareAfter,
      paid,
      ahead: fromCents(Math.max(0, ahead)),
      writtenOffBefore: off ? off.amount : null,
      writtenOffAfter: off ? fromCents(Math.min(toCents(off.amount), openNow)) : fromCents(openNow),
      state: off
        ? "WRITTEN_OFF"
        : toCents(one.shareAfter) === 0
          ? "NOT_PAID"
          : ahead >= 0
            ? "PAID"
            : paid > 0
              ? "PARTIALLY_PAID"
              : "NOT_PAID",
    };
  });
}
