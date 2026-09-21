"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

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
  // Minted once: a second try must finish the group it started, never open another one.
  const [ids] = useState(() => ({ group: newEntityId(), expense: newEntityId() }));
  const [made, setMade] = useState(false);

  async function split({ split: resolved, shares, people }: SplitResult) {
    // A default has no total to divide, and it cannot name guests: those live in the expense alone.
    const carriesOwn =
      resolved.mode === "EXACT" || resolved.mode === "FIXED_REST" || resolved.guests !== null;
    try {
      if (!made) {
        await createGroup.mutateAsync({
          id: ids.group,
          name,
          color: randomColorToken(),
          contactIds: people.flatMap((one) => (one.contactId === null ? [] : [one.contactId])),
          defaultSplit:
            resolved.mode === "PERCENT" && resolved.guests === null
              ? {
                  mode: "PERCENT",
                  shares: shares
                    .filter((share) => share.party !== "GUESTS")
                    .map((share) => ({ contactId: share.contactId, percent: share.percent ?? 0 })),
                }
              : { mode: "EQUAL", shares: [] },
        });
        setMade(true);
      }
      await createExpense.mutateAsync({
        row: {
          id: ids.expense,
          groupId: ids.group,
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
      onDone?.(ids.group);
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
