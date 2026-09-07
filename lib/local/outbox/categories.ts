import type { Category, CreateCategoryInput, RestoreInput, UpdateCategoryInput } from "@/types/api";

import { categoryRecord } from "../schema";
import { newEntityId } from "./envelope";
import { NotProjectableError, patch, projectionContext } from "./projected";
import { type LocalChange, unsent, type VaultDb, type WriteTransaction } from "./queue";
import { write } from "./write";

async function currentRow(tx: WriteTransaction, id: string): Promise<Category> {
  const record = await tx.objectStore("categories").get(id);
  if (!record) throw new NotProjectableError(`category ${id}, which the mirror does not hold`);
  return record.row;
}

async function projectCategory(
  tx: WriteTransaction,
  id: string,
  next: Category,
): Promise<LocalChange> {
  const store = tx.objectStore("categories");
  const previous = await store.get(id);
  await store.put(categoryRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "category", id));
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn: [],
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("categories");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

const readBack =
  (id: string) =>
  async (db: VaultDb): Promise<Category> => {
    const record = await db.get("categories", id);
    if (!record) throw new NotProjectableError(`category ${id} after queueing it`);
    return record.row;
  };

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  const id = input.id ?? newEntityId();
  const body: CreateCategoryInput = { ...input, id };
  return write<Category>({
    local: {
      entity: "category",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const { userId } = await projectionContext(tx, occurredAt);
        return projectCategory(tx, id, {
          id,
          name: body.name,
          icon: body.icon ?? null,
          color: body.color ?? null,
          type: body.type ?? "EXPENSE",
          userId,
          archivedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      },
    },
    optimistic: readBack(id),
  });
}

export function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  return write<Category>({
    local: {
      entity: "category",
      entityId: id,
      action: "update",
      payload: { body: input },
      project: async (tx) => projectCategory(tx, id, patch(await currentRow(tx, id), input)),
    },
    optimistic: readBack(id),
  });
}

export function archiveCategory(id: string): Promise<unknown> {
  return write<unknown>({
    local: {
      entity: "category",
      entityId: id,
      action: "archive",
      payload: {},
      project: async (tx, occurredAt) =>
        projectCategory(tx, id, { ...(await currentRow(tx, id)), archivedAt: occurredAt }),
    },
    optimistic: () => null,
  });
}

export function restoreCategory(id: string, input: RestoreInput = {}): Promise<Category> {
  return write<Category>({
    local: {
      entity: "category",
      entityId: id,
      action: "restore",
      payload: { body: input },
      project: async (tx) =>
        projectCategory(tx, id, patch({ ...(await currentRow(tx, id)), archivedAt: null }, input)),
    },
    optimistic: readBack(id),
  });
}
