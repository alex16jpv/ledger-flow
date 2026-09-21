import { api } from "@/lib/api/client";
import type { SharedGroup, SharedGroupList } from "@/types/api";

import { deriveShared, type SharedGroupView } from "../derive/shared";
import type { VaultDb } from "../outbox/queue";
import { mirrorPage, read } from "./read";

export const SHARED_GROUP_PAGE_LIMIT = 50;

export interface SharedGroupListParams {
  includeArchived?: boolean;
  limit?: number;
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

// The feed sends the group as stored; `totals` and `status` are worked out on every read, here too.
async function groupsOf(db: VaultDb): Promise<SharedGroup[]> {
  const [groups, expenses, settlements] = await Promise.all([
    db.getAll("sharedGroups"),
    db.getAll("sharedExpenses"),
    db.getAll("settlements"),
  ]);
  const ledger = deriveShared({
    groups: groups.map((record) => record.row),
    expenses: expenses.map((record) => record.row),
    settlements: settlements.map((record) => record.row),
  });
  const views = new Map(ledger.groups.map((view) => [view.id, view]));
  return groups.flatMap((record) => {
    const view = views.get(record.id);
    return view ? [{ ...record.row, totals: totalsOf(view), status: view.status }] : [];
  });
}

export function readSharedGroups(params: SharedGroupListParams = {}): Promise<SharedGroupList> {
  const limit = params.limit ?? SHARED_GROUP_PAGE_LIMIT;
  return read<SharedGroupList>(
    () =>
      api<SharedGroupList>("/shared-groups", {
        query: { includeArchived: params.includeArchived ? "true" : undefined, limit },
      }),
    async (db) => {
      const rows = await groupsOf(db);
      return mirrorPage(
        rows.filter((row) => params.includeArchived === true || row.archivedAt === null),
        limit,
      );
    },
  );
}

// The API answers for an archived group too, so the mirror does not filter here either.
export function readSharedGroup(id: string): Promise<SharedGroup> {
  return read<SharedGroup>(
    () => api<SharedGroup>(`/shared-groups/${id}`),
    async (db) => (await groupsOf(db)).find((row) => row.id === id),
  );
}
