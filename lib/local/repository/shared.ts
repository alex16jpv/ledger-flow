import { api } from "@/lib/api/client";
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
import { read } from "./read";

const PAGE_LIMIT = 100;

// What the whole section reads. A payment is imputed over every group it shares with that person,
// so no figure here can be worked out from one group alone: the rows travel together or not at all.
export interface SharedLedgerRows {
  groups: SharedGroup[];
  expenses: SharedExpense[];
  settlements: Settlement[];
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

async function drain<T extends { id: string }>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const data: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<{
      data: T[];
      pagination: { hasMore: boolean; nextCursor: string | null };
    }>(path, { query: { ...query, limit: PAGE_LIMIT, cursor } });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

async function fromServer(): Promise<SharedLedgerRows> {
  const groups = await drain<SharedGroupList["data"][number]>("/shared-groups", {
    includeArchived: "true",
  });
  const [expenses, settlements] = await Promise.all([
    Promise.all(
      groups.map((group) =>
        drain<SharedExpenseList["data"][number]>(`/shared-groups/${group.id}/expenses`),
      ),
    ),
    drain<SettlementList["data"][number]>("/settlements"),
  ]);
  return { groups, expenses: expenses.flat(), settlements };
}

// The feed sends the group as stored; `totals` and `status` are worked out on every read, here too.
async function fromMirror(db: VaultDb): Promise<SharedLedgerRows> {
  const [groups, expenses, settlements] = await Promise.all([
    db.getAll("sharedGroups"),
    db.getAll("sharedExpenses"),
    db.getAll("settlements"),
  ]);
  const live = {
    expenses: expenses.filter((record) => record.deleted === 0).map((record) => record.row),
    settlements: settlements.filter((record) => record.deleted === 0).map((record) => record.row),
  };
  const ledger = deriveShared({
    groups: groups.map((record) => record.row),
    ...live,
  });
  const views = new Map(ledger.groups.map((view) => [view.id, view]));
  return {
    groups: groups.flatMap((record) => {
      const view = views.get(record.id);
      return view ? [{ ...record.row, totals: totalsOf(view), status: view.status }] : [];
    }),
    ...live,
  };
}

export function readSharedLedger(): Promise<SharedLedgerRows> {
  return read<SharedLedgerRows>(fromServer, fromMirror);
}
