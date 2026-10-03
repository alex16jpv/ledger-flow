import { imputeCounterparty, type OwedLine } from "@/lib/local/derive";
import { fromCents, toCents } from "@/lib/local/derive/money";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { SharedExpense } from "@/types/api";

import type { GroupView, PartyView, SharedSection } from "./ledger";

export interface SettleLine {
  expenseId: string;
  groupId: string;
  groupName: string;
  description: string | null;
  date: string;
  amount: number;
}

// What is open with them in the group the sheet was opened from, which is what it proposes.
export interface SettleScope {
  groupId: string;
  groupName: string;
  owedToYou: number;
  youOwe: number;
  net: number;
}

export interface SettleParty {
  key: string;
  contactId: string | null;
  // A block of guests lives in one expense, which is the only thing there is to settle with it.
  expenseId: string | null;
  name: string;
  color: ColorToken | null;
  owedToYou: number;
  youOwe: number;
  net: number;
  // Their money in your account: what you hand over beyond your own lines goes back to them.
  surplus: number;
  theyOwe: SettleLine[];
  yourLines: SettleLine[];
  groups: { id: string; name: string }[];
  scope: SettleScope | null;
}

export interface CoveredLine extends SettleLine {
  covered: number;
}

export interface SettlePlan {
  collected: number;
  paid: number;
  // What physically changes hands, which is what the sheet asks for.
  cash: number;
  covers: CoveredLine[];
  yourLines: CoveredLine[];
  refunded: number;
  groupId: string | null;
}

const oldestFirst = (a: SettleLine, b: SettleLine): number =>
  Date.parse(a.date) - Date.parse(b.date) ||
  (a.expenseId < b.expenseId ? -1 : a.expenseId > b.expenseId ? 1 : 0);

const yourShareOf = (expense: SharedExpense): number =>
  expense.split.shares.find((share) => share.party === "USER")?.amount ?? 0;

const shareKey = (expense: SharedExpense, index: number): string | null => {
  const share = expense.split.shares[index];
  if (!share) return null;
  if (share.party === "GUESTS") return `guests:${expense.id}`;
  return share.party === "CONTACT" && share.contactId ? `contact:${share.contactId}` : null;
};

function linesOf(
  section: SharedSection,
  key: string,
  contactId: string | null,
): { theyOwe: SettleLine[]; yourLines: SettleLine[] } {
  const theyOwe: SettleLine[] = [];
  const yourLines: SettleLine[] = [];
  for (const view of section.groups) {
    for (const expense of view.expenses) {
      const line = {
        expenseId: expense.id,
        groupId: view.group.id,
        groupName: view.group.name,
        description: expense.description,
        date: expense.date,
      };
      if (expense.paidByContactId === null) {
        for (const [index, share] of expense.split.shares.entries()) {
          if (shareKey(expense, index) !== key) continue;
          const open =
            toCents(share.amount) - toCents(section.collected.get(`${expense.id}|${key}`) ?? 0);
          if (open > 0) theyOwe.push({ ...line, amount: fromCents(open) });
        }
        continue;
      }
      if (contactId === null || expense.paidByContactId !== contactId) continue;
      const open =
        toCents(yourShareOf(expense)) - toCents(section.collected.get(`${expense.id}|user`) ?? 0);
      if (open > 0) yourLines.push({ ...line, amount: fromCents(open) });
    }
  }
  return { theyOwe: theyOwe.sort(oldestFirst), yourLines: yourLines.sort(oldestFirst) };
}

interface PartySeed {
  key: string;
  contactId: string | null;
  expenseId: string | null;
  name: string;
  color: ColorToken | null;
  owedToYou: number;
  youOwe: number;
  surplus: number;
  groups: { id: string; name: string }[];
}

const partyOf = (section: SharedSection, seed: PartySeed): SettleParty => ({
  ...seed,
  net: fromCents(toCents(seed.owedToYou) - toCents(seed.youOwe)),
  ...linesOf(section, seed.key, seed.contactId),
  scope: null,
});

// A person is settled across every group at once; a block of guests has only its own expense.
export function settlePerson(section: SharedSection, contactId: string): SettleParty | undefined {
  const person = section.people.find((one) => one.contactId === contactId);
  if (!person) return undefined;
  return partyOf(section, {
    key: `contact:${contactId}`,
    contactId,
    expenseId: null,
    name: person.name,
    color: person.color,
    owedToYou: person.owesYou,
    youOwe: person.youOwe,
    surplus: person.surplus,
    groups: person.groups,
  });
}

const guestParty = (section: SharedSection, view: GroupView, person: PartyView): SettleParty =>
  partyOf(section, {
    key: person.key,
    contactId: null,
    expenseId: person.expenseId,
    name: person.name,
    color: person.color,
    owedToYou: person.owesYou,
    // A block that paid ahead is money of theirs in your account, and giving it back is a payment.
    youOwe: fromCents(toCents(person.youOwe) + toCents(person.surplus)),
    surplus: person.surplus,
    groups: [{ id: view.group.id, name: view.group.name }],
  });

function scopeOf(view: GroupView, person: PartyView): SettleScope {
  return {
    groupId: view.group.id,
    groupName: view.group.name,
    owedToYou: person.owesYou,
    youOwe: person.youOwe,
    net: fromCents(toCents(person.owesYou) - toCents(person.youOwe)),
  };
}

export function settleParty(
  section: SharedSection,
  view: GroupView,
  person: PartyView,
): SettleParty {
  if (person.contactId === null) return guestParty(section, view, person);
  const party = settlePerson(section, person.contactId);
  if (!party) return guestParty(section, view, person);
  return { ...party, scope: scopeOf(view, person) };
}

const owedLines = (lines: readonly SettleLine[]): OwedLine[] =>
  lines.map((line) => ({
    key: line.expenseId,
    date: line.date,
    owed: toCents(line.amount),
    groupId: line.groupId,
  }));

// The order the server answers what it covered: the group it was paid from first, then the oldest.
function covered(
  lines: readonly SettleLine[],
  settled: ReadonlyMap<string, number>,
  groupId: string | null,
): CoveredLine[] {
  const rank = (line: SettleLine): number => (line.groupId === groupId ? 0 : 1);
  return lines
    .map((line) => ({ ...line, covered: fromCents(settled.get(line.expenseId) ?? 0) }))
    .filter((line) => line.covered > 0)
    .sort((a, b) => rank(a) - rank(b));
}

export const isInbound = (party: SettleParty): boolean =>
  party.scope !== null && toCents(party.scope.net) !== 0 ? party.scope.net > 0 : party.net >= 0;

const totalLeansIn = (party: SettleParty, inbound: boolean): boolean =>
  inbound ? party.net > 0 : party.net < 0;

export const settleableAmount = (party: SettleParty): number =>
  Math.abs(party.scope ? party.scope.net : party.net);

export function settleCap(party: SettleParty): number {
  if (!party.scope) return Math.abs(party.net);
  const total = totalLeansIn(party, isInbound(party)) ? Math.abs(party.net) : 0;
  return Math.max(Math.abs(party.scope.net), total);
}

export const capIsTheGroup = (party: SettleParty): boolean =>
  party.scope !== null &&
  (!totalLeansIn(party, isInbound(party)) ||
    toCents(Math.abs(party.scope.net)) > toCents(Math.abs(party.net)));

export const hasSomethingToSettle = (party: SettleParty): boolean => {
  const open = party.scope ?? party;
  return open.owedToYou > 0 || open.youOwe > 0;
};

// The sheet asks for what changes hands; both halves are recorded only once that squares it.
export function planSettlement(party: SettleParty, cash: number): SettlePlan {
  const { scope } = party;
  const inbound = isInbound(party);
  const groupFull = scope !== null && toCents(cash) === toCents(Math.abs(scope.net));
  const wholeFull =
    !groupFull &&
    toCents(cash) === toCents(Math.abs(party.net)) &&
    (scope === null || totalLeansIn(party, inbound));
  const collected = groupFull ? scope.owedToYou : wholeFull ? party.owedToYou : inbound ? cash : 0;
  const paid = groupFull ? scope.youOwe : wholeFull ? party.youOwe : inbound ? 0 : cash;
  const groupId = scope?.groupId ?? null;
  const imputed = imputeCounterparty(owedLines(party.theyOwe), owedLines(party.yourLines), [
    { id: "", createdAt: null, collected: toCents(collected), paid: toCents(paid), groupId },
  ]);
  const yourLines = covered(party.yourLines, imputed.yours, groupId);
  const assigned = yourLines.reduce((cents, line) => cents + toCents(line.covered), 0);
  return {
    collected,
    paid,
    cash,
    covers: covered(party.theyOwe, imputed.theirs, groupId),
    yourLines,
    refunded: fromCents(toCents(paid) - assigned),
    groupId,
  };
}

// Squaring a group before a write-off: what you owe them there crossed against what they owe you.
export function planCrossing(party: SettleParty): SettlePlan | null {
  const { scope } = party;
  if (!scope) return null;
  const crossed = Math.min(toCents(scope.owedToYou), toCents(scope.youOwe));
  if (crossed <= 0) return null;
  const imputed = imputeCounterparty(owedLines(party.theyOwe), owedLines(party.yourLines), [
    { id: "", createdAt: null, collected: crossed, paid: crossed, groupId: scope.groupId },
  ]);
  return {
    collected: fromCents(crossed),
    paid: fromCents(crossed),
    cash: 0,
    covers: covered(party.theyOwe, imputed.theirs, scope.groupId),
    yourLines: covered(party.yourLines, imputed.yours, scope.groupId),
    refunded: 0,
    groupId: scope.groupId,
  };
}
