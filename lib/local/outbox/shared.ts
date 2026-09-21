import { dayKey } from "@/lib/format/dates";
import type {
  AddParticipantsInput,
  CreateSettlementInput,
  CreateSharedExpenseInput,
  CreateSharedGroupInput,
  DefaultSplit,
  Settlement,
  SharedExpense,
  SharedSplit,
  SyncSharedGroup,
  SyncTransaction,
  UpdateSharedExpenseInput,
  UpdateSharedGroupInput,
  WriteOffInput,
} from "@/types/api";

import { fromCents, toCents } from "../derive/money";
import { withoutParticipant } from "../derive/shared";
import {
  settlementRecord,
  sharedExpenseRecord,
  sharedGroupRecord,
  transactionRecord,
} from "../schema";
import { type MoneyEffect, newEntityId } from "./envelope";
import { NotProjectableError, type ProjectionContext, projectionContext } from "./projected";
import {
  dependenciesOf,
  type LocalChange,
  unsent,
  type VaultDb,
  type WriteTransaction,
} from "./queue";
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

// The server stamps the movement when it takes the expense; with no network the copy must say it
// too, or the same movement can be split twice and the second one is refused much later.
async function stamp(
  tx: WriteTransaction,
  transactionId: string,
  expense: SharedExpense | null,
): Promise<(() => Promise<void>) | undefined> {
  const store = tx.objectStore("transactions");
  const previous = await store.get(transactionId);
  if (!previous) return undefined;
  await store.put(
    transactionRecord(
      {
        ...previous.row,
        sharedExpenseId: expense?.id ?? null,
        sharedGroupId: expense?.groupId ?? null,
      },
      previous.server,
    ),
  );
  return async () => {
    await tx.objectStore("transactions").put(previous);
  };
}

async function projectExpense(
  tx: WriteTransaction,
  id: string,
  next: SharedExpense,
  transactionId?: string,
): Promise<LocalChange> {
  const store = tx.objectStore("sharedExpenses");
  const previous = await store.get(id);
  await store.put(sharedExpenseRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "sharedExpense", id));
  const unstamp = transactionId === undefined ? undefined : await stamp(tx, transactionId, next);
  // The expense is posted under its group: a group the server has not seen yet has to go first.
  const dependsOn = await dependenciesOf(tx, [
    { entity: "sharedGroup" as const, id: next.groupId },
  ]);
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn,
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("sharedExpenses");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
      await unstamp?.();
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
        return projectExpense(
          tx,
          row.id,
          {
            ...row,
            userId,
            currency,
            deletedAt: null,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
          transactionId,
        );
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

export interface WriteOffTarget {
  groupId: string;
  contactId: string | null;
  expenseId: string | null;
}

type StoredWriteOff = SyncSharedGroup["writeOffs"][number];

const samePartyAs = (target: WriteOffTarget) => (one: StoredWriteOff) =>
  one.contactId === target.contactId && one.expenseId === target.expenseId;

async function currentGroup(tx: WriteTransaction, id: string): Promise<SyncSharedGroup> {
  const record = await tx.objectStore("sharedGroups").get(id);
  if (!record) throw new NotProjectableError(`shared group ${id}, which the mirror does not hold`);
  return record.row;
}

const partyIdOf = (target: WriteOffTarget): string => {
  const id = target.expenseId ?? target.contactId;
  if (!id) throw new Error("a write-off naming neither a contact nor a block of guests");
  return id;
};

const writeOffBody = (target: WriteOffTarget): WriteOffInput =>
  target.expenseId === null
    ? { contactId: target.contactId ?? undefined }
    : { expenseId: target.expenseId };

// The ceiling is what was open when you decided, which is what the server stores with it.
export function writeOffParty(target: WriteOffTarget, amount: number): Promise<SyncSharedGroup> {
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: target.groupId,
      action: "writeOff",
      payload: {
        body: writeOffBody(target),
        params: { partyId: partyIdOf(target) },
        writtenOff: amount,
      },
      project: async (tx, occurredAt) => {
        const group = await currentGroup(tx, target.groupId);
        const entry: StoredWriteOff = {
          kind: target.expenseId === null ? "CONTACT" : "GUESTS",
          contactId: target.contactId,
          expenseId: target.expenseId,
          amount,
          at: occurredAt,
        };
        return projectGroup(tx, target.groupId, {
          ...group,
          writeOffs: [...group.writeOffs.filter((one) => !samePartyAs(target)(one)), entry],
        });
      },
    },
    optimistic: groupBack(target.groupId),
  });
}

export function undoWriteOff(target: WriteOffTarget): Promise<SyncSharedGroup> {
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: target.groupId,
      action: "undoWriteOff",
      payload: { params: { partyId: partyIdOf(target) } },
      project: async (tx) => {
        const group = await currentGroup(tx, target.groupId);
        return projectGroup(tx, target.groupId, {
          ...group,
          writeOffs: group.writeOffs.filter((one) => !samePartyAs(target)(one)),
        });
      },
    },
    optimistic: groupBack(target.groupId),
  });
}

export interface ArchivedGroup {
  id: string;
  // What each party still owes when you archive: the server writes it off on your behalf.
  owing: { contactId: string | null; expenseId: string | null; amount: number }[];
}

export function archiveSharedGroup({ id, owing }: ArchivedGroup): Promise<SyncSharedGroup> {
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "archive",
      payload: { archivedOwing: owing },
      project: async (tx, occurredAt) => {
        const group = await currentGroup(tx, id);
        const kept = group.writeOffs.filter(
          (one) =>
            !owing.some(
              (party) => party.contactId === one.contactId && party.expenseId === one.expenseId,
            ),
        );
        return projectGroup(tx, id, {
          ...group,
          archivedAt: occurredAt,
          writeOffs: [
            ...kept,
            ...owing.map((party) => ({
              kind: party.expenseId === null ? ("CONTACT" as const) : ("GUESTS" as const),
              contactId: party.contactId,
              expenseId: party.expenseId,
              amount: party.amount,
              at: occurredAt,
            })),
          ],
        });
      },
    },
    optimistic: groupBack(id),
  });
}

export interface SettledLine {
  expenseId: string;
  date: string;
  description: string | null;
  amount: number;
  categoryId: string;
}

export interface NewSettlement {
  id?: string;
  counterparty: { contactId: string | null; expenseId: string | null };
  date: string;
  collected: number;
  paid: number;
  // Cash the app never saw: no movement is written and no balance moves.
  outsideApp: boolean;
  accountId: string | null;
  // One expense of yours per line you are covering, each dated and described by that line.
  lines: SettledLine[];
  // What you hand over beyond your own lines: their money going back to them.
  refunded: number;
}

type MintedMovement = Pick<
  SyncTransaction,
  "id" | "type" | "amount" | "date" | "fromAccountId" | "toAccountId" | "categoryId" | "description"
>;

// The device mints its own so the list, the day totals and the balance move together with no network.
function mintMovements(input: NewSettlement): MintedMovement[] {
  const { accountId } = input;
  if (input.outsideApp || accountId === null) return [];
  const rows: MintedMovement[] = [];
  if (input.collected > 0) {
    rows.push({
      id: newEntityId(),
      type: "SETTLEMENT",
      amount: input.collected,
      date: input.date,
      fromAccountId: null,
      toAccountId: accountId,
      categoryId: null,
      description: null,
    });
  }
  for (const line of input.lines) {
    rows.push({
      id: newEntityId(),
      type: "EXPENSE",
      amount: line.amount,
      date: line.date,
      fromAccountId: accountId,
      toAccountId: null,
      categoryId: line.categoryId,
      description: line.description,
    });
  }
  if (input.refunded > 0) {
    rows.push({
      id: newEntityId(),
      type: "SETTLEMENT",
      amount: input.refunded,
      date: input.date,
      fromAccountId: accountId,
      toAccountId: null,
      categoryId: null,
      description: null,
    });
  }
  return rows;
}

const mintedRow = (
  movement: MintedMovement,
  settlementId: string,
  owner: ProjectionContext,
): SyncTransaction => ({
  ...movement,
  dayKey: dayKey(new Date(movement.date), owner.timeZone),
  userId: owner.userId,
  currency: owner.currency,
  tags: [],
  note: null,
  pendingDetails: false,
  source: "MANUAL",
  countsAsYours: movement.amount,
  sharedExpenseId: null,
  sharedGroupId: null,
  sharedSettlementId: settlementId,
  sharedHistory: [],
  deletedAt: null,
  createdAt: owner.occurredAt,
  updatedAt: owner.occurredAt,
});

// The net of both halves on one account: `projectBalances` reads the effect, never these rows.
function netEffect(input: NewSettlement): MoneyEffect | undefined {
  const { accountId } = input;
  if (input.outsideApp || accountId === null) return undefined;
  const cents = toCents(input.collected) - toCents(input.paid);
  if (cents === 0) return undefined;
  return {
    before: null,
    after: {
      type: "SETTLEMENT",
      amount: fromCents(Math.abs(cents)),
      fromAccountId: cents < 0 ? accountId : null,
      toAccountId: cents > 0 ? accountId : null,
      deletedAt: null,
    },
  };
}

// The section adds its figures up; a currency with cents must not reach the wire as 30000.0000004.
const exact = (amount: number): number => fromCents(toCents(amount));

const settlementBody = (input: NewSettlement, id: string): CreateSettlementInput => ({
  id,
  ...(input.counterparty.contactId ? { contactId: input.counterparty.contactId } : {}),
  ...(input.counterparty.expenseId ? { expenseId: input.counterparty.expenseId } : {}),
  date: input.date,
  ...(input.collected > 0 ? { collected: exact(input.collected) } : {}),
  ...(input.paid > 0 ? { paid: exact(input.paid) } : {}),
  ...(input.outsideApp ? { outsideApp: true } : {}),
  ...(input.accountId && !input.outsideApp ? { accountId: input.accountId } : {}),
  ...(input.lines.length > 0
    ? {
        // One per line, and the first as the fallback: the server may impute onto a line this
        // device did not plan for, and a line with no category is refused.
        categoryId: input.lines[0]?.categoryId,
        categories: input.lines.map((line) => ({
          expenseId: line.expenseId,
          categoryId: line.categoryId,
        })),
      }
    : {}),
});

export function recordSettlement(input: NewSettlement): Promise<Settlement> {
  const id = input.id ?? newEntityId();
  const minted = mintMovements(input);
  const effect = netEffect(input);
  return write<Settlement>({
    local: {
      entity: "settlement",
      entityId: id,
      action: "create",
      payload: {
        body: settlementBody(input, id),
        ...(effect ? { effect } : {}),
        ...(minted.length > 0 ? { minted: minted.map((movement) => movement.id) } : {}),
      },
      project: async (tx, occurredAt) => {
        const owner = await projectionContext(tx, occurredAt);
        const row: Settlement = {
          id,
          userId: owner.userId,
          counterparty: {
            kind: input.counterparty.expenseId === null ? "CONTACT" : "GUESTS",
            contactId: input.counterparty.contactId,
            expenseId: input.counterparty.expenseId,
          },
          date: input.date,
          collected: input.collected,
          paid: input.paid,
          outsideApp: input.outsideApp,
          currency: owner.currency,
          deletedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        };
        await tx.objectStore("settlements").put(settlementRecord(row));
        for (const movement of minted) {
          await tx
            .objectStore("transactions")
            .put(transactionRecord(mintedRow(movement, id, owner)));
        }
        const dependsOn = await dependenciesOf(tx, [
          { entity: "contact" as const, id: input.counterparty.contactId },
          { entity: "sharedExpense" as const, id: input.counterparty.expenseId },
          ...input.lines.map((line) => ({ entity: "sharedExpense" as const, id: line.expenseId })),
        ]);
        return {
          dependsOn,
          undo: async (undoTx) => {
            await undoTx.objectStore("settlements").delete(id);
            for (const movement of minted) {
              await undoTx.objectStore("transactions").delete(movement.id);
            }
          },
        };
      },
    },
    optimistic: async (db: VaultDb): Promise<Settlement> => {
      const record = await db.get("settlements", id);
      if (!record) throw new NotProjectableError(`payment ${id} after queueing it`);
      return record.row;
    },
  });
}

export interface EditedGroup {
  id: string;
  name: string;
  color: SyncSharedGroup["color"];
  defaultSplit: DefaultSplit;
}

export function updateSharedGroup({
  id,
  name,
  color,
  defaultSplit,
}: EditedGroup): Promise<SyncSharedGroup> {
  const body: UpdateSharedGroupInput = { name, color, defaultSplit };
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "update",
      payload: { body },
      project: async (tx) =>
        projectGroup(tx, id, { ...(await currentGroup(tx, id)), name, color, defaultSplit }),
    },
    optimistic: groupBack(id),
  });
}

export interface AddedParticipants {
  id: string;
  contactIds: string[];
  // On, the server re-splits every expense it can; the pull that follows brings those back.
  applyToExistingExpenses: boolean;
  defaultSplit?: DefaultSplit;
}

export function addParticipants({
  id,
  contactIds,
  applyToExistingExpenses,
  defaultSplit,
}: AddedParticipants): Promise<SyncSharedGroup> {
  const body: AddParticipantsInput = {
    contactIds,
    ...(applyToExistingExpenses ? { applyToExistingExpenses: true } : {}),
    ...(defaultSplit ? { defaultSplit } : {}),
  };
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "addParticipants",
      payload: { body },
      project: async (tx, occurredAt) => {
        const group = await currentGroup(tx, id);
        return projectGroup(tx, id, {
          ...group,
          ...(defaultSplit ? { defaultSplit } : {}),
          participants: [
            ...group.participants,
            ...contactIds
              .filter((contactId) => !group.participants.some((one) => one.contactId === contactId))
              .map((contactId) => ({ contactId, addedAt: occurredAt })),
          ],
        });
      },
    },
    optimistic: groupBack(id),
  });
}

// Taking them out takes their write-off with them: coming back does not come back forgiven.
const withoutParty = (group: SyncSharedGroup, contactId: string): SyncSharedGroup => ({
  ...group,
  participants: group.participants.filter((one) => one.contactId !== contactId),
  writeOffs: group.writeOffs.filter((one) => one.contactId !== contactId),
  defaultSplit: withoutParticipant(group.defaultSplit, contactId),
});

export interface RemovedParticipant {
  id: string;
  contactId: string;
}

export function removeParticipant({ id, contactId }: RemovedParticipant): Promise<SyncSharedGroup> {
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "removeParticipant",
      payload: { params: { partyId: contactId } },
      project: async (tx) => {
        const group = await currentGroup(tx, id);
        return projectGroup(tx, id, withoutParty(group, contactId));
      },
    },
    optimistic: groupBack(id),
  });
}

export function restoreSharedGroup(id: string): Promise<SyncSharedGroup> {
  return write<SyncSharedGroup>({
    local: {
      entity: "sharedGroup",
      entityId: id,
      action: "restore",
      payload: {},
      project: async (tx) =>
        projectGroup(tx, id, { ...(await currentGroup(tx, id)), archivedAt: null }),
    },
    optimistic: groupBack(id),
  });
}
