"use client";

import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/Toast";
import { type SplitPerson, SplitSheet } from "@/features/shared/components/SplitSheet";
import { useContactsQuery, useSaveSharedSplit } from "@/features/shared/hooks";
import { GUESTS_KEY, USER_KEY } from "@/features/shared/split";
import { draftFromGroup, inheritedSplit } from "@/features/shared/write";
import { presentError } from "@/lib/api/errors";
import { useMoney } from "@/lib/i18n/useMoney";
import type { SharedExpense, SharedSplit, SyncSharedGroup } from "@/types/api";

export interface EditSplitSheetProps {
  group: SyncSharedGroup;
  expense: SharedExpense;
  open: boolean;
  onClose: () => void;
}

function draftOf(expense: SharedExpense, group: SyncSharedGroup) {
  if (!expense.customSplit) return draftFromGroup(group);
  return {
    mode: expense.split.mode,
    guests: expense.split.guests,
    inputs: Object.fromEntries(
      expense.split.shares.map((share) => [
        share.party === "GUESTS" ? GUESTS_KEY : (share.contactId ?? USER_KEY),
        expense.split.mode === "PERCENT" ? share.percent : share.fixedAmount,
      ]),
    ),
  };
}

export function EditSplitSheet({ group, expense, open, onClose }: EditSplitSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const contacts = useContactsQuery(true);
  const saveSplit = useSaveSharedSplit();
  const you = t("shared.group.you");
  const byId = new Map((contacts.data ?? []).map((row) => [row.id, row]));
  // Everybody the group holds, you included, whether or not they are in an expense yet.
  const people: SplitPerson[] = group.participants.map((participant) => {
    const held = participant.contactId === null ? undefined : byId.get(participant.contactId);
    return {
      contactId: participant.contactId,
      name: participant.contactId === null ? you : (held?.name ?? ""),
      color: held?.color ?? null,
    };
  });

  async function save(split: SharedSplit | null) {
    try {
      await saveSplit.mutateAsync({
        id: expense.id,
        groupId: expense.groupId,
        split,
        projected: split ?? inheritedSplit(group, expense.amount, expense.paidByContactId),
      });
      onClose();
      toast.show({ message: t("shared.split.saved") });
    } catch (error) {
      onClose();
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <SplitSheet
      key={expense.id}
      open={open}
      onClose={onClose}
      title={t("shared.split.title", {
        amount: money.format(expense.amount),
        description: expense.description ?? t("shared.group.noDescription"),
      })}
      total={expense.amount}
      currency={expense.currency}
      people={people}
      payerContactId={expense.paidByContactId}
      initial={draftOf(expense, group)}
      note={t("shared.split.thisExpenseOnly", { name: group.name })}
      saveLabel={t("shared.split.save")}
      pending={saveSplit.isPending}
      onUseGroupSplit={
        expense.customSplit
          ? () => {
              void save(null);
            }
          : undefined
      }
      onSave={({ split }) => {
        void save(split);
      }}
    />
  );
}
