import type { JoinedExpense, JoinedGroup, SyncTransaction } from "@/types/api";

import { fromCents, toCents } from "./money";
import type { PersonState } from "./shared";

export type JoinedLineState =
  "IN_LEDGER" | "PAID" | "NOT_PAID" | "WRITTEN_OFF" | "OTHER_PAID" | "YOU_PAID" | "NO_PART";

export interface JoinedLine {
  id: string;
  state: JoinedLineState;
  yourShare: number;
  addedId: string | null;
  addedAmount: number | null;
  addedCategoryId: string | null;
  addedAccountId: string | null;
  stillPaid: boolean;
}

export interface JoinedPerson {
  contactId: string | null;
  share: number;
  paid: number;
  open: number;
  state: PersonState | null;
}

export interface JoinedGroupStanding {
  id: string;
  amount: number;
  yourShare: number;
  youOwe: number;
  ownerOwes: number;
  net: number;
  paidToOwner: number;
  owedToOwner: number;
  state: PersonState;
  dateFrom: string | null;
  dateTo: string | null;
  lines: JoinedLine[];
  people: JoinedPerson[];
  ready: string[];
}

const you = (group: JoinedGroup): string | null =>
  group.participants.find((participant) => participant.you)?.contactId ?? null;

const shareOf = (expense: JoinedExpense, contactId: string | null) =>
  expense.split.shares.find((share) =>
    contactId === null
      ? share.party === "USER"
      : share.party === "CONTACT" && share.contactId === contactId,
  );

function stateOf(share: number, paid: number, open: number, writtenOff: boolean): PersonState {
  if (writtenOff) return "WRITTEN_OFF";
  if (open === 0 && share > 0) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
}

export function deriveJoined(
  group: JoinedGroup,
  expenses: readonly JoinedExpense[],
  added: readonly SyncTransaction[],
): JoinedGroupStanding {
  const me = you(group);
  const rows = expenses.filter((expense) => expense.groupId === group.id && !expense.deletedAt);
  const addedByLine = new Map(
    added.flatMap((row) =>
      !row.deletedAt && row.importedFromExpenseId
        ? [[row.importedFromExpenseId, row] as const]
        : [],
    ),
  );
  const forgiven = new Map(
    group.writeOffs.flatMap((entry) =>
      entry.kind === "CONTACT" && entry.contactId
        ? [[entry.contactId, toCents(entry.amount)] as const]
        : [],
    ),
  );

  const people = new Map<string, { share: number; paid: number; open: number }>();
  let amount = 0;
  let yourShare = 0;
  let ownerOwes = 0;
  for (const expense of rows) {
    amount += toCents(expense.amount);
    const mine = shareOf(expense, me);
    if (mine) yourShare += toCents(mine.amount);
    for (const participant of group.participants) {
      if (participant.contactId === null) continue;
      const share = shareOf(expense, participant.contactId);
      const person = people.get(participant.contactId) ?? { share: 0, paid: 0, open: 0 };
      if (share) person.share += toCents(share.amount);
      if (share && expense.paidByContactId === null) {
        const paid = Math.min(toCents(share.collected), toCents(share.amount));
        person.paid += paid;
        person.open += toCents(share.amount) - paid;
      }
      people.set(participant.contactId, person);
    }
    if (me !== null && expense.paidByContactId === me) {
      const owner = shareOf(expense, null);
      if (owner) ownerOwes += Math.max(0, toCents(owner.amount) - toCents(owner.collected));
    }
  }

  const personOf = (contactId: string): JoinedPerson => {
    const person = people.get(contactId) ?? { share: 0, paid: 0, open: 0 };
    const ceiling = forgiven.get(contactId);
    const open = ceiling === undefined ? person.open : person.open - Math.min(ceiling, person.open);
    return {
      contactId,
      share: fromCents(person.share),
      paid: fromCents(person.paid),
      open: fromCents(open),
      state: stateOf(person.share, person.paid, open, ceiling !== undefined),
    };
  };

  const mine = me === null ? null : personOf(me);
  const lines = rows.map((expense): JoinedLine => {
    const share = shareOf(expense, me);
    const yours = share ? toCents(share.amount) : 0;
    const settled = share ? toCents(share.collected) >= yours && yours > 0 : false;
    const addedRow = addedByLine.get(expense.id);
    const base = {
      id: expense.id,
      yourShare: fromCents(yours),
      addedId: null,
      addedAmount: null,
      addedCategoryId: null,
      addedAccountId: null,
      stillPaid: settled,
    };
    if (expense.paidByContactId !== null) {
      return { ...base, state: expense.paidByContactId === me ? "YOU_PAID" : "OTHER_PAID" };
    }
    if (addedRow) {
      return {
        ...base,
        state: "IN_LEDGER",
        addedId: addedRow.id,
        addedAmount: addedRow.amount,
        addedCategoryId: addedRow.categoryId,
        addedAccountId: addedRow.fromAccountId,
      };
    }
    if (yours === 0) return { ...base, state: "NO_PART" };
    if (settled) return { ...base, state: "PAID" };
    return { ...base, state: mine?.state === "WRITTEN_OFF" ? "WRITTEN_OFF" : "NOT_PAID" };
  });

  const dates = rows.map((expense) => Date.parse(expense.date)).sort((a, b) => a - b);
  const stamp = (at: number | undefined): string | null =>
    at === undefined ? null : new Date(at).toISOString();
  return {
    id: group.id,
    amount: fromCents(amount),
    yourShare: fromCents(yourShare),
    youOwe: mine?.open ?? 0,
    ownerOwes: fromCents(ownerOwes),
    net: fromCents(toCents(mine?.open ?? 0) - ownerOwes),
    paidToOwner: mine?.paid ?? 0,
    owedToOwner: fromCents(toCents(mine?.paid ?? 0) + toCents(mine?.open ?? 0)),
    state: mine?.state ?? "PAID",
    dateFrom: stamp(dates[0]),
    dateTo: stamp(dates.at(-1)),
    lines,
    people: group.participants.map((participant) =>
      participant.contactId === null
        ? { contactId: null, share: fromCents(sharesOfOwner(rows)), paid: 0, open: 0, state: null }
        : personOf(participant.contactId),
    ),
    ready: lines.filter((line) => line.state === "PAID").map((line) => line.id),
  };
}

function sharesOfOwner(rows: readonly JoinedExpense[]): number {
  let total = 0;
  for (const expense of rows) {
    const share = shareOf(expense, null);
    if (share) total += toCents(share.amount);
  }
  return total;
}

export interface JoinedOwnerTotal {
  ownerId: string;
  name: string;
  youOwe: number;
  ownerOwes: number;
  groupsYouOwe: number;
  groupsOwingYou: number;
}

export interface JoinedTotals {
  youOwe: number;
  ownerOwes: number;
  owners: JoinedOwnerTotal[];
}

export function joinedTotals(
  groups: readonly JoinedGroup[],
  standings: ReadonlyMap<string, JoinedGroupStanding>,
): JoinedTotals {
  const owners = new Map<
    string,
    {
      name: string;
      youOwe: number;
      ownerOwes: number;
      groupsYouOwe: number;
      groupsOwingYou: number;
    }
  >();
  let youOwe = 0;
  let ownerOwes = 0;
  for (const group of groups) {
    const standing = standings.get(group.id);
    if (!standing) continue;
    const owner = owners.get(group.ownerId) ?? {
      name: group.ownerName,
      youOwe: 0,
      ownerOwes: 0,
      groupsYouOwe: 0,
      groupsOwingYou: 0,
    };
    const mine = toCents(standing.youOwe);
    const theirs = toCents(standing.ownerOwes);
    owner.youOwe += mine;
    owner.ownerOwes += theirs;
    if (mine > 0) owner.groupsYouOwe += 1;
    if (theirs > 0) owner.groupsOwingYou += 1;
    owners.set(group.ownerId, owner);
    youOwe += mine;
    ownerOwes += theirs;
  }
  return {
    youOwe: fromCents(youOwe),
    ownerOwes: fromCents(ownerOwes),
    owners: [...owners].map(([ownerId, owner]) => ({
      ...owner,
      ownerId,
      youOwe: fromCents(owner.youOwe),
      ownerOwes: fromCents(owner.ownerOwes),
    })),
  };
}
