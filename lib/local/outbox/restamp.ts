import type { Restamp } from "@/types/api";

import { operationsFor, type WriteTransaction } from "./queue";
import { reconcileRow } from "./reconcile";

const STORE_OF = {
  sharedExpense: "sharedExpenses",
  transaction: "transactions",
} as const satisfies Record<Restamp["entity"], string>;

interface Answered {
  row: unknown;
  restamped: Restamp[];
}

// A route answers `restamped` beside its row; the mirror stores the row, never the list.
export function splitRestamps(answer: unknown): Answered {
  if (typeof answer !== "object" || answer === null || !("restamped" in answer)) {
    return { row: answer, restamped: [] };
  }
  const { restamped, ...row } = answer;
  return { row, restamped: Array.isArray(restamped) ? (restamped as Restamp[]) : [] };
}

export interface Restamped {
  // Queued operations whose guard moved: a plan read before this holds the old ones.
  guards: number;
  // Mirror rows that now carry the server's stamp before its content, which only a pull brings.
  rows: number;
}

// Backend T-145: a stamp is moved only from the exact one the server replaced, never from another.
export async function applyRestamps(
  tx: WriteTransaction,
  restamps: readonly Restamp[],
): Promise<Restamped> {
  const outbox = tx.objectStore("outbox");
  const moved: Restamped = { guards: 0, rows: 0 };
  for (const { entity, id, previousUpdatedAt, updatedAt } of restamps) {
    for (const queued of await operationsFor(tx, entity, id)) {
      if (queued.baseUpdatedAt !== previousUpdatedAt) continue;
      await outbox.put({ ...queued, baseUpdatedAt: updatedAt });
      moved.guards += 1;
    }
    const record = await tx.objectStore(STORE_OF[entity]).get(id);
    const baseline = record?.server ?? record?.row;
    if (baseline?.updatedAt !== previousUpdatedAt) continue;
    await reconcileRow(tx, entity, id, { ...baseline, updatedAt });
    moved.rows += 1;
  }
  return moved;
}
