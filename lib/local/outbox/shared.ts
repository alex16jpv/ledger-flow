import type {
  CreateSharedExpenseInput,
  CreateSharedGroupInput,
  SharedExpense,
  SharedSplit,
  SyncSharedGroup,
  UpdateSharedExpenseInput,
} from "@/types/api";

import { sharedExpenseRecord, sharedGroupRecord } from "../schema";
import { newEntityId } from "./envelope";
import { NotProjectableError, projectionContext } from "./projected";
import { type LocalChange, unsent, type VaultDb, type WriteTransaction } from "./queue";
import { write } from "./write";

// What the split resolved to is the device's arithmetic; the server works it out from what it is sent.
const sentSplit = (split: SharedSplit): NonNullable<CreateSharedExpenseInput["split"]> => ({
  mode: split.mode,
  guests: split.guests,
  shares: split.shares.map((share) => ({
    party: share.party,
    contactId: share.contactId,
    percent: share.percent,
    fixedAmount: share.fixedAmount,
  })),
});

async function projectGroup(
  tx: WriteTransaction,
  id: string,
  next: SyncSharedGroup,
): Promise<LocalChange> {
  const store = tx.objectStore("sharedGroups");
  const previous = await store.get(id);
  await store.put(sharedGroupRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "sharedGroup", id));
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn: [],
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("sharedGroups");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

async function projectExpense(
  tx: WriteTransaction,
  id: string,
  next: SharedExpense,
): Promise<LocalChange> {
  const store = tx.objectStore("sharedExpenses");
  const previous = await store.get(id);
  await store.put(sharedExpenseRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "sharedExpense", id));
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn: [],
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("sharedExpenses");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

const groupBack =
  (id: string) =>
  async (db: VaultDb): Promise<SyncSharedGroup> => {
    const record = await db.get("sharedGroups", id);
    if (!record) throw new NotProjectableError(`shared group ${id} after queueing it`);
    return record.row;
  };

const expenseBack =
  (id: string) =>
  async (db: VaultDb): Promise<SharedExpense> => {
    const record = await db.get("sharedExpenses", id);
    if (!record) throw new NotProjectableError(`shared expense ${id} after queueing it`);
    return record.row;
  };

export type NewSharedGroup = Pick<SyncSharedGroup, "name" | "color" | "defaultSplit"> & {
  id?: string;
  // You are always a participant and are never named here.
  contactIds: string[];
};

export function createSharedGroup(input: NewSharedGroup): Promise<SyncSharedGroup> {
  const id = input.id ?? newEntityId();
  const body: CreateSharedGroupInput = {
    id,
    name: input.name,
    ...(input.color ? { color: input.color } : {}),
    contactIds: input.contactIds,
    defaultSplit: input.defaultSplit,
  };
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const { userId, currency } = await projectionContext(tx, occurredAt);
        return projectGroup(tx, id, {
          id,
          name: input.name,
          color: input.color ?? null,
          participants: [null, ...input.contactIds].map((contactId) => ({
            contactId,
            addedAt: occurredAt,
          })),
          defaultSplit: input.defaultSplit,
          writeOffs: [],
          userId,
          currency,
          archivedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      },
    },
    optimistic: groupBack(id),
  });
}

export interface NewSharedExpense {
  // What the mirror holds while the server has not seen it, split resolved.
  row: Omit<SharedExpense, "userId" | "currency" | "createdAt" | "updatedAt" | "deletedAt">;
  // Set when the expense is a movement of yours: the body carries it instead of the three fields.
  transactionId?: string;
}

export function createSharedExpense({
  row,
  transactionId,
}: NewSharedExpense): Promise<SharedExpense> {
  const body: CreateSharedExpenseInput = {
    id: row.id,
    // Carrying a split is what sets `customSplit`: one that inherits sends none.
    ...(row.customSplit ? { split: sentSplit(row.split) } : {}),
    ...(transactionId === undefined
      ? {
          description: row.description,
          date: row.date,
          amount: row.amount,
          paidByContactId: row.paidByContactId,
        }
      : { transactionId }),
  };
  return write<SharedExpense>({
    local: {
      entity: "sharedExpense",
      entityId: row.id,
      action: "create",
      payload: { body, params: { groupId: row.groupId } },
      project: async (tx, occurredAt) => {
        const { userId, currency } = await projectionContext(tx, occurredAt);
        return projectExpense(tx, row.id, {
          ...row,
          userId,
          currency,
          deletedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      },
    },
    optimistic: expenseBack(row.id),
  });
}

async function currentExpense(tx: WriteTransaction, id: string): Promise<SharedExpense> {
  const record = await tx.objectStore("sharedExpenses").get(id);
  if (!record)
    throw new NotProjectableError(`shared expense ${id}, which the mirror does not hold`);
  return record.row;
}

export interface SavedSplit {
  id: string;
  groupId: string;
  // null hands the expense back to the group's default, which is what `useGroupSplit` means.
  split: SharedSplit | null;
  // What either of the two resolves to here, which is what the mirror holds until the server answers.
  projected: SharedSplit;
}

export function saveSharedSplit({
  id,
  groupId,
  split,
  projected,
}: SavedSplit): Promise<SharedExpense> {
  const body: UpdateSharedExpenseInput =
    split === null ? { useGroupSplit: true } : { split: sentSplit(split) };
  return write<SharedExpense>({
    local: {
      entity: "sharedExpense",
      entityId: id,
      action: "update",
      payload: { body, params: { groupId } },
      project: async (tx) =>
        projectExpense(tx, id, {
          ...(await currentExpense(tx, id)),
          split: projected,
          customSplit: split !== null,
        }),
    },
    optimistic: expenseBack(id),
  });
}
