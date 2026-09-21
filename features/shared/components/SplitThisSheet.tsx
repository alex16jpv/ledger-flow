"use client";

import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/Toast";
import { presentError } from "@/lib/api/errors";
import { newEntityId } from "@/lib/local/outbox/envelope";
import { randomColorToken } from "@/lib/theme/feature-color";
import type { Transaction } from "@/types/api";

import { useCreateSharedExpense, useCreateSharedGroup } from "../hooks";
import { type SplitResult, SplitSheet } from "./SplitSheet";

export interface SplitThisSheetProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  onDone?: (groupId: string) => void;
}

export function SplitThisSheet({ open, onClose, transaction, onDone }: SplitThisSheetProps) {
  const t = useTranslations();
  const toast = useToast();
  const createGroup = useCreateSharedGroup();
  const createExpense = useCreateSharedExpense();
  const name = transaction.description ?? t("shared.group.noDescription");

  async function split({ split: resolved, shares, people }: SplitResult) {
    // A default has no total to divide, so an exact or fixed split is the expense's alone.
    const carriesOwn =
      resolved.mode === "EXACT" || resolved.mode === "FIXED_REST" || resolved.guests !== null;
    try {
      const group = await createGroup.mutateAsync({
        name,
        color: randomColorToken(),
        contactIds: people.flatMap((one) => (one.contactId === null ? [] : [one.contactId])),
        defaultSplit:
          resolved.mode === "PERCENT"
            ? {
                mode: "PERCENT",
                shares: shares
                  .filter((share) => share.party !== "GUESTS")
                  .map((share) => ({ contactId: share.contactId, percent: share.percent ?? 0 })),
              }
            : { mode: "EQUAL", shares: [] },
      });
      await createExpense.mutateAsync({
        row: {
          id: newEntityId(),
          groupId: group.id,
          description: transaction.description,
          date: transaction.date,
          amount: transaction.amount,
          paidByContactId: null,
          split: resolved,
          customSplit: carriesOwn,
        },
        transactionId: transaction.id,
      });
      toast.show({ message: t("shared.split.done") });
      onClose();
      onDone?.(group.id);
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <SplitSheet
      open={open}
      onClose={onClose}
      title={t("shared.split.looseTitle", { description: name })}
      total={transaction.amount}
      currency={transaction.currency}
      people={[{ contactId: null, name: t("shared.group.you"), color: null }]}
      payerContactId={null}
      choosePeople
      note={t("shared.split.creates", { name })}
      saveLabel={t("shared.split.splitIt")}
      pending={createGroup.isPending || createExpense.isPending}
      onSave={(result) => {
        void split(result);
      }}
    />
  );
}
