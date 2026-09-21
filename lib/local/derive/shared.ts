import type { ErrorCode } from "@/lib/api/errors";
import { currencyFractionDigits } from "@/lib/format/currency";
import type {
  Settlement,
  SharedExpense,
  SharedShare,
  SharedSplit,
  SyncSharedGroup,
} from "@/types/api";

import { fromCents, toCents } from "./money";

// The fields each figure needs: this runs over the mirror and over the parity fixtures.
export type LedgerWriteOff = Pick<
  SyncSharedGroup["writeOffs"][number],
  "contactId" | "expenseId" | "amount"
>;

export type LedgerGroup = Pick<SyncSharedGroup, "id"> & {
  writeOffs: readonly LedgerWriteOff[];
};

export type LedgerExpense = Pick<
  SharedExpense,
  "id" | "groupId" | "date" | "amount" | "paidByContactId" | "split" | "deletedAt"
>;

export type LedgerSettlement = Pick<
  Settlement,
  "counterparty" | "collected" | "paid" | "deletedAt"
>;

export type SplitMode = SharedSplit["mode"];

export interface SplitRow {
  // 1 for a person; the head count for a block of guests.
  units: number;
  // The percentage under PERCENT, the amount under EXACT, the amount of a pinned share under FIXED_REST.
  input: number | null;
}

export interface SplitInput {
  total: number;
  currency: string;
  mode: SplitMode;
  rows: SplitRow[];
  // The row that fronted the money, which is the one that absorbs the odd minor unit.
  payerIndex: number;
}

export class SplitInvalidError extends Error {
  readonly code = "SPLIT_INVALID" satisfies ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = "SplitInvalidError";
  }
}

const PERCENT_SCALE = 100;

const invalid = (message: string): SplitInvalidError => new SplitInvalidError(message);

const toMinor = (amount: number, scale: number): number => Math.round(amount * scale);

// Split so no product passes 2^53, which is what lets 64-bit integers on the server reach this figure.
const partOf = (total: number, part: number, whole: number): number =>
  Math.floor(total / whole) * part + Math.floor(((total % whole) * part) / whole);

function assertShape(input: SplitInput, scale: number): void {
  const { rows, payerIndex, mode } = input;
  if (rows.length === 0) throw invalid("A split needs at least one share");
  if (payerIndex < 0 || payerIndex >= rows.length) {
    throw invalid("The payer must be one of the shares");
  }
  if (rows.some((row) => !Number.isInteger(row.units) || row.units < 1)) {
    throw invalid("Every share weighs at least one part");
  }
  if (toMinor(input.total, scale) <= 0) {
    throw invalid("An expense to split must be greater than zero");
  }
  if (mode === "EQUAL") {
    if (rows.some((row) => row.input !== null)) throw invalid("An equal split takes no figures");
    return;
  }
  if (mode === "FIXED_REST") {
    if (rows.every((row) => row.input !== null)) {
      throw invalid("A fixed-plus-rest split needs somebody to take the rest");
    }
    return;
  }
  if (rows.some((row) => row.input === null)) {
    throw invalid("Every share needs its own figure in this split");
  }
}

const inputOf = (row: SplitRow): number => row.input ?? 0;

function equalShares(totalMinor: number, rows: SplitRow[]): number[] {
  const units = rows.reduce((sum, row) => sum + row.units, 0);
  return rows.map((row) => partOf(totalMinor, row.units, units));
}

function percentShares(totalMinor: number, rows: SplitRow[]): number[] {
  const basisPoints = rows.map((row) => Math.round(inputOf(row) * PERCENT_SCALE));
  const whole = PERCENT_SCALE * PERCENT_SCALE;
  if (basisPoints.some((points) => points < 0)) throw invalid("A percentage cannot be negative");
  if (basisPoints.reduce((sum, points) => sum + points, 0) !== whole) {
    throw invalid("The percentages of a split must add up to 100");
  }
  return basisPoints.map((points) => partOf(totalMinor, points, whole));
}

function exactShares(totalMinor: number, rows: SplitRow[], scale: number): number[] {
  const shares = rows.map((row) => toMinor(inputOf(row), scale));
  if (shares.some((share) => share < 0)) throw invalid("A share cannot be negative");
  if (shares.reduce((sum, share) => sum + share, 0) !== totalMinor) {
    throw invalid("The shares of a split must add up to the expense");
  }
  return shares;
}

function fixedRestShares(totalMinor: number, rows: SplitRow[], scale: number): number[] {
  const pinned = rows.map((row) => (row.input === null ? null : toMinor(row.input, scale)));
  if (pinned.some((share) => share !== null && share < 0)) {
    throw invalid("A share cannot be negative");
  }
  const pinnedTotal = pinned.reduce((sum: number, share) => sum + (share ?? 0), 0);
  if (pinnedTotal > totalMinor) {
    throw invalid("The fixed shares of a split add up to more than the expense");
  }
  const restUnits = rows.reduce(
    (sum, row, index) => (pinned[index] === null ? sum + row.units : sum),
    0,
  );
  const rest = totalMinor - pinnedTotal;
  return rows.map((row, index) => pinned[index] ?? partOf(rest, row.units, restUnits));
}

// The same arithmetic the server runs, so a split made with no network agrees with it to the unit.
export function resolveShares(input: SplitInput): number[] {
  const scale = 10 ** currencyFractionDigits(input.currency);
  assertShape(input, scale);

  const totalMinor = toMinor(input.total, scale);
  const shares =
    input.mode === "EQUAL"
      ? equalShares(totalMinor, input.rows)
      : input.mode === "PERCENT"
        ? percentShares(totalMinor, input.rows)
        : input.mode === "EXACT"
          ? exactShares(totalMinor, input.rows, scale)
          : fixedRestShares(totalMinor, input.rows, scale);

  const assigned = shares.reduce((sum, share) => sum + share, 0);
  return shares.map((share, index) =>
    index === input.payerIndex ? (share + totalMinor - assigned) / scale : share / scale,
  );
}

export interface OwedLine {
  // The expense id, which also breaks the tie between two lines of the same instant.
  key: string;
  date: string;
  // Whole minor units, never negative.
  owed: number;
}

export interface Imputation {
  settled: Map<string, number>;
  // What the pool could not cover: money held that nothing is owed for.
  surplus: number;
}

const oldestFirst = (a: OwedLine, b: OwedLine): number =>
  Date.parse(a.date) - Date.parse(b.date) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function impute(lines: readonly OwedLine[], pool: number): Imputation {
  let left = Math.max(0, pool);
  const settled = new Map<string, number>();
  for (const line of [...lines].sort(oldestFirst)) {
    const covered = Math.min(Math.max(0, line.owed), left);
    settled.set(line.key, covered);
    left -= covered;
  }
  return { settled, surplus: left };
}

export type PersonState = "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";

export interface SharedPerson {
  key: string;
  contactId: string | null;
  expenseId: string | null;
  owesYou: number;
  youOwe: number;
  // Per counterparty, not per group: the same figure shows in each group and never adds up.
  surplus: number;
  state: PersonState;
}

export interface SharedGroupView {
  id: string;
  amount: number;
  yourShare: number;
  owedToYou: number;
  youOwe: number;
  collected: number;
  writtenOff: number;
  expenseCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  status: "OPEN" | "SETTLED";
  people: SharedPerson[];
}

export interface SharedLedgerInput {
  groups: readonly LedgerGroup[];
  expenses: readonly LedgerExpense[];
  settlements: readonly LedgerSettlement[];
}

export interface SharedLedger {
  // What has come back for each live expense, by its id: the figure a movement's own amount loses.
  cameBack: Map<string, number>;
  // What each share has been settled by, keyed `<expenseId>|<party key>`.
  collected: Map<string, number>;
  groups: SharedGroupView[];
}

export const partyKey = (party: { contactId: string | null; expenseId: string | null }): string =>
  party.expenseId ? `guests:${party.expenseId}` : `contact:${party.contactId}`;

const shareKey = (expense: LedgerExpense, share: SharedShare): string | null =>
  share.party === "GUESTS"
    ? `guests:${expense.id}`
    : share.party === "CONTACT" && share.contactId
      ? `contact:${share.contactId}`
      : null;

const isYours = (share: SharedShare): boolean => share.party === "USER";

const live = (row: { deletedAt: string | null }): boolean => row.deletedAt === null;

interface Settled {
  // `<expenseId>|<party key>` for what they owe you, `user|<expenseId>` for what you owe them.
  covered: Map<string, number>;
  ahead: Map<string, number>;
}

interface Owed {
  theyOwe: OwedLine[];
  youOwe: OwedLine[];
}

function imputeEverything(
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerSettlement[],
  parties: ReadonlySet<string>,
): Settled {
  const owed = new Map<string, Owed>();
  const linesOf = (key: string): Owed => {
    const found = owed.get(key);
    if (found) return found;
    const fresh: Owed = { theyOwe: [], youOwe: [] };
    owed.set(key, fresh);
    return fresh;
  };

  for (const expense of expenses) {
    const mine = expense.paidByContactId === null;
    for (const share of expense.split.shares) {
      const key = shareKey(expense, share);
      if (mine && key !== null) {
        linesOf(key).theyOwe.push({
          key: expense.id,
          date: expense.date,
          owed: toCents(share.amount),
        });
      }
      if (mine || !isYours(share)) continue;
      const payer = `contact:${expense.paidByContactId}`;
      if (parties.has(payer)) {
        linesOf(payer).youOwe.push({
          key: expense.id,
          date: expense.date,
          owed: toCents(share.amount),
        });
      }
    }
  }

  const pools = new Map<string, { theyOwe: number; youOwe: number }>();
  for (const one of settlements) {
    const key = partyKey(one.counterparty);
    const pool = pools.get(key) ?? { theyOwe: 0, youOwe: 0 };
    pool.theyOwe += toCents(one.collected);
    pool.youOwe += toCents(one.paid);
    pools.set(key, pool);
  }

  const covered = new Map<string, number>();
  const ahead = new Map<string, number>();
  for (const key of parties) {
    const lines = owed.get(key) ?? { theyOwe: [], youOwe: [] };
    const pool = pools.get(key) ?? { theyOwe: 0, youOwe: 0 };
    // What is left of what you handed over is their money back, and it comes off their pool first.
    const yours = impute(lines.youOwe, pool.youOwe);
    const theirs = impute(lines.theyOwe, pool.theyOwe - yours.surplus);
    ahead.set(key, theirs.surplus);
    for (const [expenseId, amount] of theirs.settled) covered.set(`${expenseId}|${key}`, amount);
    for (const [expenseId, amount] of yours.settled) covered.set(`user|${expenseId}`, amount);
  }

  return { covered, ahead };
}

function viewOf(
  group: LedgerGroup,
  rows: readonly LedgerExpense[],
  settled: Settled,
): SharedGroupView {
  const ceilings = new Map(group.writeOffs.map((one) => [partyKey(one), toCents(one.amount)]));
  const people = new Map<string, SharedPerson>();
  const paidInto = new Map<string, number>();
  let amount = 0;
  let yourShare = 0;
  let owedGross = 0;
  let youOwe = 0;
  let collectedTotal = 0;

  const rowFor = (
    key: string,
    contactId: string | null,
    expenseId: string | null,
  ): SharedPerson => {
    const found = people.get(key);
    if (found) return found;
    const fresh: SharedPerson = {
      key,
      contactId,
      expenseId,
      owesYou: 0,
      youOwe: 0,
      surplus: fromCents(settled.ahead.get(key) ?? 0),
      state: "NOT_PAID",
    };
    people.set(key, fresh);
    return fresh;
  };

  for (const expense of rows) {
    amount += toCents(expense.amount);
    for (const share of expense.split.shares) {
      if (isYours(share)) {
        yourShare += toCents(share.amount);
        if (expense.paidByContactId === null) continue;
        const covered = settled.covered.get(`user|${expense.id}`) ?? 0;
        const open = Math.max(0, toCents(share.amount) - covered);
        youOwe += open;
        rowFor(`contact:${expense.paidByContactId}`, expense.paidByContactId, null).youOwe += open;
        continue;
      }
      if (expense.paidByContactId !== null) continue;
      const key = shareKey(expense, share);
      if (key === null) continue;
      const covered = settled.covered.get(`${expense.id}|${key}`) ?? 0;
      const open = Math.max(0, toCents(share.amount) - covered);
      owedGross += open;
      collectedTotal += covered;
      paidInto.set(key, (paidInto.get(key) ?? 0) + covered);
      rowFor(
        key,
        share.party === "GUESTS" ? null : share.contactId,
        share.party === "GUESTS" ? expense.id : null,
      ).owesYou += open;
    }
  }

  let writtenOff = 0;
  for (const [key, person] of people) {
    const ceiling = ceilings.get(key);
    if (ceiling !== undefined) {
      // What was open when you gave up, never more than is open now: paying later lowers it.
      const forgiven = Math.min(ceiling, person.owesYou);
      writtenOff += forgiven;
      person.owesYou -= forgiven;
      person.state = "WRITTEN_OFF";
      continue;
    }
    person.state =
      person.owesYou === 0 ? "PAID" : (paidInto.get(key) ?? 0) > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
  }

  const owedToYou = owedGross - writtenOff;
  const dates = rows.map((expense) => Date.parse(expense.date)).sort((a, b) => a - b);
  const stamp = (at: number | undefined): string | null =>
    at === undefined ? null : new Date(at).toISOString();
  return {
    id: group.id,
    amount: fromCents(amount),
    yourShare: fromCents(yourShare),
    owedToYou: fromCents(owedToYou),
    youOwe: fromCents(youOwe),
    collected: fromCents(collectedTotal),
    writtenOff: fromCents(writtenOff),
    expenseCount: rows.length,
    dateFrom: stamp(dates[0]),
    dateTo: stamp(dates.at(-1)),
    status: owedToYou === 0 && youOwe === 0 ? "SETTLED" : "OPEN",
    people: [...people.values()]
      .map((person) => ({
        ...person,
        owesYou: fromCents(person.owesYou),
        youOwe: fromCents(person.youOwe),
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

// Invariant 2: a projection of what the server would answer, never a figure it sent.
export function deriveShared(input: SharedLedgerInput): SharedLedger {
  const expenses = input.expenses.filter(live);
  const settlements = input.settlements.filter(live);

  const parties = new Set<string>();
  for (const expense of expenses) {
    for (const share of expense.split.shares) {
      const key = shareKey(expense, share);
      if (key !== null) parties.add(key);
    }
  }

  const settled = imputeEverything(expenses, settlements, parties);

  const cameBack = new Map<string, number>();
  const collected = new Map<string, number>();
  for (const expense of expenses) {
    const mine = expense.paidByContactId === null;
    let back = 0;
    for (const share of expense.split.shares) {
      if (isYours(share)) {
        collected.set(
          `${expense.id}|user`,
          mine ? 0 : fromCents(settled.covered.get(`user|${expense.id}`) ?? 0),
        );
        continue;
      }
      const key = shareKey(expense, share);
      if (key === null) continue;
      const covered = mine ? (settled.covered.get(`${expense.id}|${key}`) ?? 0) : 0;
      collected.set(`${expense.id}|${key}`, fromCents(covered));
      back += covered;
    }
    if (mine) cameBack.set(expense.id, fromCents(back));
  }

  const byGroup = new Map<string, LedgerExpense[]>();
  for (const expense of expenses) {
    const rows = byGroup.get(expense.groupId);
    if (rows) rows.push(expense);
    else byGroup.set(expense.groupId, [expense]);
  }

  return {
    cameBack,
    collected,
    groups: input.groups.map((group) => viewOf(group, byGroup.get(group.id) ?? [], settled)),
  };
}

export function countsAsYours(
  transaction: { amount: number; sharedExpenseId: string | null },
  ledger: Pick<SharedLedger, "cameBack">,
): number {
  if (transaction.sharedExpenseId === null) return transaction.amount;
  const back = ledger.cameBack.get(transaction.sharedExpenseId);
  if (back === undefined) return transaction.amount;
  return fromCents(toCents(transaction.amount) - toCents(back));
}
