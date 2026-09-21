import type { NewSharedExpense } from "@/lib/local/outbox";
import { newEntityId } from "@/lib/local/outbox/envelope";
import type { DefaultSplit, SharedSplit, SyncSharedGroup, Transaction } from "@/types/api";

import { partiesOf, resolveDraft, type SplitDraft, USER_KEY } from "./split";

// The group's default is only EQUAL or PERCENT: a default has no total to divide.
export function groupDefaultSplit(
  mode: DefaultSplit["mode"],
  contactIds: (string | null)[],
  percent: Record<string, string>,
): DefaultSplit {
  if (mode === "EQUAL") return { mode, shares: [] };
  return {
    mode,
    shares: contactIds.map((contactId) => ({
      contactId,
      percent: Number.parseFloat(percent[contactId ?? USER_KEY] ?? "") || 0,
    })),
  };
}

export function draftFromGroup(group: Pick<SyncSharedGroup, "defaultSplit">): SplitDraft {
  const { defaultSplit } = group;
  return {
    mode: defaultSplit.mode,
    guests: null,
    inputs: Object.fromEntries(
      defaultSplit.shares.map((share) => [share.contactId ?? USER_KEY, share.percent]),
    ),
  };
}

export type SplittingGroup = Pick<
  SyncSharedGroup,
  "id" | "participants" | "defaultSplit" | "currency"
>;

export function inheritedSplit(
  group: SplittingGroup,
  amount: number,
  payerContactId: string | null = null,
): SharedSplit {
  const parties = partiesOf(
    group.participants.map((participant) => ({
      contactId: participant.contactId,
      name: "",
      color: null,
    })),
    null,
  );
  const draft = draftFromGroup(group);
  return {
    mode: draft.mode,
    guests: null,
    shares: resolveDraft(draft, parties, amount, group.currency, payerContactId ?? USER_KEY),
  };
}

// A movement of yours joining a group: the body carries the link, never the three fields again.
export function expenseFromTransaction(
  group: SplittingGroup,
  transaction: Transaction,
  id: string = newEntityId(),
): NewSharedExpense {
  return {
    row: {
      id,
      groupId: group.id,
      description: transaction.description,
      date: transaction.date,
      amount: transaction.amount,
      paidByContactId: null,
      split: inheritedSplit(group, transaction.amount),
      customSplit: false,
    },
    transactionId: transaction.id,
  };
}
