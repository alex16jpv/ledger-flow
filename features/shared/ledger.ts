import { deriveShared, fromCents, partyKey, type PersonState, toCents } from "@/lib/local/derive";
import type { SharedLedgerRows } from "@/lib/local/repository";
import type { SharedExpenseLookup, SharedLookup, SharedPaymentLookup } from "@/lib/shared/lookup";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { Contact, Settlement, SharedExpense, SharedGroup, SharedShare } from "@/types/api";

export interface PartyView {
  key: string;
  contactId: string | null;
  // A block of guests lives in one expense and is named after it; it is never a contact.
  expenseId: string | null;
  name: string;
  color: ColorToken | null;
  share: number;
  paid: number;
  owesYou: number;
  youOwe: number;
  // Their money in your account, once a share falls under what they already paid.
  surplus: number;
  state: PersonState;
}

export interface GroupView {
  group: SharedGroup;
  expenses: SharedExpense[];
  countsAsYours: number;
  collected: number;
  writtenOff: number;
  owed: number;
  youOwe: number;
  barTotal: number;
  people: PartyView[];
  you: { share: number };
}

export interface PersonView {
  contactId: string;
  name: string;
  color: ColorToken | null;
  owesYou: number;
  youOwe: number;
  net: number;
  // Their money in your account, and the same figure on their row in every group.
  surplus: number;
  groups: { id: string; name: string }[];
}

export interface SharedSection {
  groups: GroupView[];
  // What each share has been settled by, keyed `<expenseId>|<party key>`, and `|user` for yours.
  collected: ReadonlyMap<string, number>;
  // What has come back for each expense you fronted: the figure its movement loses.
  cameBack: ReadonlyMap<string, number>;
  contacts: number;
  settlements: Settlement[];
  undone: Settlement[];
  dropped: SharedExpense[];
  people: PersonView[];
  // Guest blocks are not people: one line closes the arithmetic instead of a row each.
  guests: { owed: number; groupCount: number };
  owedToYou: number;
  youOwe: number;
}

const GUESTS_COLOR: ColorToken = "GRAY";

// Both lists read newest first, keyset over `(date, id)`, which is how the endpoints answer them.
const newestFirst = (a: { date: string; id: string }, b: { date: string; id: string }): number =>
  Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const isYours = (share: SharedShare): boolean => share.party === "USER";

const keyOf = (expense: SharedExpense, share: SharedShare): string | null =>
  share.party === "GUESTS"
    ? partyKey({ contactId: null, expenseId: expense.id })
    : share.party === "CONTACT" && share.contactId
      ? partyKey({ contactId: share.contactId, expenseId: null })
      : null;

interface Tally {
  share: number;
  // What has come back from them, which is never what you handed over on a line they fronted.
  paid: number;
}

function tallies(expenses: readonly SharedExpense[], collected: ReadonlyMap<string, number>) {
  const rows = new Map<string, Tally>();
  let yours = 0;
  const of = (key: string): Tally => {
    const found = rows.get(key);
    if (found) return found;
    const fresh: Tally = { share: 0, paid: 0 };
    rows.set(key, fresh);
    return fresh;
  };
  for (const expense of expenses) {
    for (const share of expense.split.shares) {
      if (isYours(share)) {
        yours += share.amount;
        continue;
      }
      const key = keyOf(expense, share);
      if (key === null) continue;
      const tally = of(key);
      tally.share += share.amount;
      if (expense.paidByContactId === null)
        tally.paid += collected.get(`${expense.id}|${key}`) ?? 0;
    }
  }
  return { rows, yours };
}

function guestName(expenses: readonly SharedExpense[], expenseId: string): string {
  const expense = expenses.find((row) => row.id === expenseId);
  return expense?.split.guests?.name ?? expense?.description ?? "";
}

export function sectionOf(rows: SharedLedgerRows, contacts: readonly Contact[]): SharedSection {
  const ledger = deriveShared(rows);
  const byId = new Map(contacts.map((row) => [row.id, row]));
  const expensesOf = new Map<string, SharedExpense[]>();
  for (const expense of rows.expenses) {
    const held = expensesOf.get(expense.groupId);
    if (held) held.push(expense);
    else expensesOf.set(expense.groupId, [expense]);
  }

  const groups: GroupView[] = [];
  for (const group of rows.groups) {
    const view = ledger.groups.find((one) => one.id === group.id);
    if (!view) continue;
    const expenses = expensesOf.get(group.id) ?? [];
    const { rows: tally, yours } = tallies(expenses, ledger.collected);
    const fronted = expenses
      .filter((expense) => expense.paidByContactId === null)
      .reduce((cents, expense) => cents + toCents(expense.amount), 0);
    const paidBack = expenses
      .filter((expense) => expense.paidByContactId !== null)
      .reduce(
        (cents, expense) => cents + toCents(ledger.collected.get(`${expense.id}|user`) ?? 0),
        0,
      );
    const people = view.people.map((person): PartyView => {
      const contact = person.contactId === null ? undefined : byId.get(person.contactId);
      const held = tally.get(person.key) ?? { share: 0, paid: 0 };
      return {
        key: person.key,
        contactId: person.contactId,
        expenseId: person.expenseId,
        name:
          person.expenseId === null ? (contact?.name ?? "") : guestName(expenses, person.expenseId),
        color: person.expenseId === null ? (contact?.color ?? null) : GUESTS_COLOR,
        share: held.share,
        paid: held.paid,
        owesYou: person.owesYou,
        youOwe: person.youOwe,
        surplus: person.surplus,
        state: person.state,
      };
    });
    const owed = people.reduce(
      (cents, person) => cents + Math.max(0, toCents(person.owesYou) - toCents(person.youOwe)),
      0,
    );
    groups.push({
      group,
      expenses: [...expenses].sort(newestFirst),
      countsAsYours: fromCents(fronted - toCents(view.collected) + paidBack),
      collected: view.collected,
      writtenOff: view.writtenOff,
      owed: fromCents(owed),
      youOwe: view.youOwe,
      barTotal: fromCents(toCents(view.collected) + owed + toCents(view.writtenOff)),
      people,
      you: { share: yours },
    });
  }

  const nets = new Map<string, { owesYou: number; youOwe: number; groups: Set<string> }>();
  let guestsOwed = 0;
  const guestGroups = new Set<string>();
  for (const view of groups) {
    for (const person of view.people) {
      if (person.contactId === null) {
        const open = Math.max(0, person.owesYou - person.youOwe);
        if (open > 0) {
          guestsOwed += open;
          guestGroups.add(view.group.id);
        }
        continue;
      }
      const held = nets.get(person.contactId) ?? {
        owesYou: 0,
        youOwe: 0,
        groups: new Set<string>(),
      };
      held.owesYou += toCents(person.owesYou);
      // Per counterparty, not per group: the same surplus shows in each and must be taken once.
      held.youOwe += toCents(person.youOwe);
      held.groups.add(view.group.id);
      nets.set(person.contactId, held);
    }
  }

  const surplusOf = new Map<string, number>();
  for (const view of groups) {
    for (const person of view.people) {
      if (person.contactId !== null) surplusOf.set(person.contactId, person.surplus);
    }
  }

  const nameOf = new Map(groups.map((view) => [view.group.id, view.group.name]));
  // Somebody you keep but have not split anything with yet is a row too: it is where they are read.
  for (const contact of contacts) {
    if (contact.archivedAt === null && !nets.has(contact.id)) {
      nets.set(contact.id, { owesYou: 0, youOwe: 0, groups: new Set<string>() });
    }
  }
  const people: PersonView[] = [...nets].map(([contactId, held]) => {
    const contact = byId.get(contactId);
    const youOwe = held.youOwe + toCents(surplusOf.get(contactId) ?? 0);
    return {
      contactId,
      name: contact?.name ?? "",
      color: contact?.color ?? null,
      owesYou: fromCents(held.owesYou),
      youOwe: fromCents(youOwe),
      net: fromCents(held.owesYou - youOwe),
      surplus: surplusOf.get(contactId) ?? 0,
      groups: [...held.groups].map((id) => ({ id, name: nameOf.get(id) ?? "" })),
    };
  });
  people.sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));

  return {
    groups,
    collected: ledger.collected,
    cameBack: ledger.cameBack,
    contacts: contacts.filter((row) => row.archivedAt === null).length,
    settlements: [...rows.settlements].sort(newestFirst),
    undone: rows.undone,
    dropped: rows.dropped,
    people,
    guests: { owed: guestsOwed, groupCount: guestGroups.size },
    owedToYou: fromCents(
      people.reduce((cents, person) => cents + Math.max(0, toCents(person.net)), 0) +
        toCents(guestsOwed),
    ),
    youOwe: fromCents(
      people.reduce((cents, person) => cents + Math.max(0, -toCents(person.net)), 0),
    ),
  };
}

export const groupView = (section: SharedSection, id: string): GroupView | undefined =>
  section.groups.find((view) => view.group.id === id);

export const personView = (section: SharedSection, contactId: string): PersonView | undefined =>
  section.people.find((view) => view.contactId === contactId);

export function sharedLookup(section: SharedSection): SharedLookup {
  const expenses = new Map<string, SharedExpenseLookup>();
  const names = new Map<string, { name: string; groups: Set<string> }>();
  // A person keeps their name once the group is settled, archived, or they are: People holds them.
  for (const person of section.people) {
    names.set(`contact:${person.contactId}`, {
      name: person.name,
      groups: new Set(person.groups.map((group) => group.name)),
    });
  }
  for (const view of section.groups) {
    for (const expense of view.expenses) {
      expenses.set(expense.id, {
        yourShare: expense.split.shares.find(isYours)?.amount ?? 0,
        groupId: view.group.id,
        groupName: view.group.name,
      });
    }
    for (const person of view.people) {
      if (person.contactId !== null) continue;
      const held = names.get(person.key) ?? { name: person.name, groups: new Set<string>() };
      held.groups.add(view.group.name);
      names.set(person.key, held);
    }
  }
  const payments = new Map<string, SharedPaymentLookup>();
  for (const one of section.settlements) {
    const held = names.get(partyKey(one.counterparty));
    payments.set(one.id, { name: held?.name ?? "", groups: [...(held?.groups ?? [])] });
  }
  return { expenses, payments };
}
