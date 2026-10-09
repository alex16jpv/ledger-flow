import type {
  Settlement,
  SettlementList,
  SharedExpense,
  SharedExpenseList,
  SharedGroup,
  SharedGroupList,
} from "@/types/api";

import { deriveShared, type SharedGroupView } from "../derive";
import type { VaultDb } from "../outbox/queue";
import { drainPages, read } from "./read";

// One request per group, four at a time: a cold device must not open sixty connections at once.
const AT_A_TIME = 4;

// What the whole section reads. A payment is imputed over every group it shares with that person,
// so no figure here can be worked out from one group alone: the rows travel together or not at all.
export interface SharedLedgerRows {
  groups: SharedGroup[];
  expenses: SharedExpense[];
  settlements: Settlement[];
  undone: Settlement[];
  // Expenses a movement took with it: the queue names them, and a mark needs their group.
  dropped: SharedExpense[];
  // Payments still in the queue, which the server will record after every one it holds.
  unstored: ReadonlySet<string>;
}

const totalsOf = (view: SharedGroupView): SharedGroup["totals"] => ({
  amount: view.amount,
  yourShare: view.yourShare,
  owedToYou: view.owedToYou,
  writtenOff: view.writtenOff,
  youOwe: view.youOwe,
  collected: view.collected,
  expenseCount: view.expenseCount,
  dateFrom: view.dateFrom,
  dateTo: view.dateTo,
});

async function inBatches<T, R>(rows: readonly T[], of: (row: T) => Promise<R>): Promise<R[]> {
  const done: R[] = [];
  for (let at = 0; at < rows.length; at += AT_A_TIME) {
    done.push(...(await Promise.all(rows.slice(at, at + AT_A_TIME).map(of))));
  }
  return done;
}

// The payments the server has not recorded yet: it will put them after every one it holds.
export async function queuedPayments(db: VaultDb): Promise<ReadonlySet<string>> {
  const queued = await db.getAllFromIndex(
    "outbox",
    "entity",
    IDBKeyRange.bound(["settlement"], ["settlement", []]),
  );
  return new Set(
    queued
      .filter((operation) => operation.action === "create")
      .map((operation) => operation.entityId),
  );
}

async function fromServer(): Promise<SharedLedgerRows> {
  const groups = await drainPages<SharedGroupList["data"][number]>("/shared-groups", {
    includeArchived: "true",
  });
  const [expenses, settlements] = await Promise.all([
    inBatches(groups, (group) =>
      drainPages<SharedExpenseList["data"][number]>(`/shared-groups/${group.id}/expenses`),
    ),
    drainPages<SettlementList["data"][number]>("/settlements"),
  ]);
  return {
    groups,
    expenses: expenses.flat(),
    settlements,
    undone: [],
    dropped: [],
    unstored: new Set(),
  };
}

// The feed sends the group as stored; `totals` and `status` are worked out on every read, here too.
async function fromMirror(db: VaultDb): Promise<SharedLedgerRows> {
  const [groups, expenses, settlements, unstored] = await Promise.all([
    db.getAll("sharedGroups"),
    db.getAll("sharedExpenses"),
    db.getAll("settlements"),
    queuedPayments(db),
  ]);
  const live = {
    expenses: expenses.filter((record) => record.deleted === 0).map((record) => record.row),
    settlements: settlements.filter((record) => record.deleted === 0).map((record) => record.row),
  };
  const ledger = deriveShared({
    groups: groups.map((record) => record.row),
    ...live,
    unstored,
  });
  const views = new Map(ledger.groups.map((view) => [view.id, view]));
  return {
    groups: groups.flatMap((record) => {
      const view = views.get(record.id);
      return view ? [{ ...record.row, totals: totalsOf(view), status: view.status }] : [];
    }),
    ...live,
    undone: settlements.filter((record) => record.deleted === 1).map((record) => record.row),
    dropped: expenses.filter((record) => record.deleted === 1).map((record) => record.row),
    unstored,
  };
}

export function readSharedLedger(): Promise<SharedLedgerRows> {
  return read<SharedLedgerRows>(fromServer, fromMirror);
}
