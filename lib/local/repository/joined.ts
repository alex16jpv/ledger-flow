import { api } from "@/lib/api/client";
import { reportError } from "@/lib/observability/reporter";
import type {
  JoinedExpense,
  JoinedExpenseList,
  JoinedGroup,
  JoinedGroupList,
  SyncTransaction,
  Transaction,
  TransactionWithRestamps,
} from "@/types/api";

import { pullAfterDirectSend } from "../outbox/engine";
import { splitRestamps } from "../outbox/restamp";
import { restampVault } from "../outbox/write";
import { transactionRecord } from "../schema";
import { currentVault, ownVault, read } from "./read";

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

// The movement moved an account's balance on the server, so its stamp moves and a pull brings the figure.
export async function keepAddedExpense(answer: TransactionWithRestamps): Promise<Transaction> {
  const { row, restamped } = splitRestamps(answer);
  const added = row as Transaction;
  const vault = ownVault();
  if (!vault) return added;
  try {
    await vault.db.put("transactions", transactionRecord({ ...added, deletedAt: null }));
  } catch (error) {
    // F-27: the movement already landed, so a vault that fails must not tell the form it did not.
    reportError(error, "vault");
  }
  await pullAfterDirectSend(await restampVault(vault.db, restamped));
  return added;
}
