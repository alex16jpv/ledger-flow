import {
  MIRROR_STORES,
  type MirrorRecord,
  type MirrorStore,
  type OutboxEntity,
  type OutboxOperation,
} from "../schema";
import { operationPayload } from "./envelope";
import type { WriteTransaction } from "./queue";

export const STORE_OF = {
  account: "accounts",
  category: "categories",
  transaction: "transactions",
  budget: "budgets",
  contact: "contacts",
  sharedGroup: "sharedGroups",
  sharedExpense: "sharedExpenses",
  settlement: "settlements",
} as const satisfies Record<OutboxEntity, MirrorStore>;

export const isCreate = (action: string): boolean => action === "create" || action === "quickAdd";

// T-170: the rows a create wrote exist only because it is queued, whatever its status.
export function unsentRows(operations: readonly OutboxOperation[]): Map<MirrorStore, string[]> {
  const rows = new Map<MirrorStore, string[]>();
  const keep = (store: MirrorStore, id: string): void => {
    const ids = rows.get(store);
    if (ids) ids.push(id);
    else rows.set(store, [id]);
  };
  for (const operation of operations) {
    if (!isCreate(operation.action)) continue;
    keep(STORE_OF[operation.entity], operation.entityId);
    for (const id of operationPayload(operation).minted ?? []) keep("transactions", id);
  }
  return rows;
}

export type CarryRecord = (
  store: MirrorStore,
  record: MirrorRecord<unknown>,
) => MirrorRecord<unknown> | null;

const asTheyAre: CarryRecord = (_store, record) => record;

export async function clearMirror(
  tx: WriteTransaction,
  queued: readonly OutboxOperation[],
  present: readonly string[] = MIRROR_STORES,
  carry: CarryRecord = asTheyAre,
): Promise<void> {
  const unsent = unsentRows(queued);
  for (const name of MIRROR_STORES) {
    if (!present.includes(name)) continue;
    const store = tx.objectStore(name);
    const kept = await Promise.all((unsent.get(name) ?? []).map((id) => store.get(id)));
    await store.clear();
    for (const record of kept) {
      const carried = record ? carry(name, record) : null;
      // A step returns the shape this build reads, which no type from an older build can state.
      if (carried) await store.put(carried as NonNullable<typeof record>);
    }
  }
}
