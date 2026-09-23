import { api } from "@/lib/api/client";
import type {
  JoinedExpense,
  JoinedExpenseList,
  JoinedGroup,
  JoinedGroupList,
  SyncTransaction,
  Transaction,
} from "@/types/api";

import { transactionRecord } from "../schema";
import { currentVault, read } from "./read";

const PAGE_LIMIT = 100;
// One request per group, four at a time: a cold device must not open a connection per group at once.
const AT_A_TIME = 4;

export interface JoinedRows {
  groups: JoinedGroup[];
  expenses: JoinedExpense[];
  added: SyncTransaction[];
}

async function drain<T extends { id: string }>(path: string): Promise<T[]> {
  const data: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<{
      data: T[];
      pagination: { hasMore: boolean; nextCursor: string | null };
    }>(path, { query: { limit: PAGE_LIMIT, cursor } });
    data.push(...page.data);
    const next = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
    if (next !== undefined && next === cursor) throw new Error(`${path} kept paging in place`);
    cursor = next;
  } while (cursor);
  return data;
}

async function fromServer(): Promise<JoinedRows> {
  const groups = await drain<JoinedGroupList["data"][number]>("/joined-groups");
  const expenses: JoinedExpense[] = [];
  for (let at = 0; at < groups.length; at += AT_A_TIME) {
    const batch = await Promise.all(
      groups
        .slice(at, at + AT_A_TIME)
        .map((group) =>
          drain<JoinedExpenseList["data"][number]>(`/joined-groups/${group.id}/expenses`),
        ),
    );
    expenses.push(...batch.flat());
  }
  return { groups, expenses, added: [] };
}

export function readJoined(): Promise<JoinedRows> {
  return read<JoinedRows>(fromServer, async (db) => {
    const [groups, expenses, added] = await Promise.all([
      db.getAll("joinedGroups"),
      db.getAll("joinedExpenses"),
      db.getAllFromIndex("transactions", "addedFrom"),
    ]);
    return {
      groups: groups.map((record) => record.row),
      expenses: expenses.filter((record) => record.deleted === 0).map((record) => record.row),
      added: added.map((record) => record.row),
    };
  });
}

export async function forgetJoinedGroup(groupId: string): Promise<void> {
  const db = currentVault()?.db;
  if (!db) return;
  const tx = db.transaction(["joinedGroups", "joinedExpenses"], "readwrite");
  const lines = await tx.objectStore("joinedExpenses").index("groupId").getAllKeys(groupId);
  await tx.objectStore("joinedGroups").delete(groupId);
  for (const id of lines) await tx.objectStore("joinedExpenses").delete(id);
  await tx.done;
}

export async function keepAddedExpense(row: Transaction): Promise<void> {
  await currentVault()?.db.put("transactions", transactionRecord({ ...row, deletedAt: null }));
}
