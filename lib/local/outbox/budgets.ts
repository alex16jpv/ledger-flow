import { api } from "@/lib/api/client";
import type {
  Budget,
  BudgetAmountOverrideInput,
  CreateBudgetInput,
  SyncBudget,
  UpdateBudgetInput,
} from "@/types/api";

import { resolvePeriod } from "../derive";
import { mirrorBudget } from "../repository/budgets";
import { budgetRecord, PROFILE_KEY } from "../schema";
import { newEntityId } from "./envelope";
import { NotProjectableError, patch, projectionContext } from "./projected";
import {
  dependenciesOf,
  type LocalChange,
  unsent,
  type VaultDb,
  type WriteTransaction,
} from "./queue";
import { write, type WriteGuard } from "./write";

const ifMatch = (guard: WriteGuard) =>
  guard.ifMatch ? { headers: { "If-Match": guard.ifMatch } } : {};

async function currentRow(tx: WriteTransaction, id: string): Promise<SyncBudget> {
  const record = await tx.objectStore("budgets").get(id);
  if (!record) throw new NotProjectableError(`budget ${id}, which the mirror does not hold`);
  return record.row;
}

// The view the API answers with drops what only the stored row carries — the override map, the
// CUSTOM dates, the owner — so the server's reply is merged over the projection instead of
// replacing it, and the next pull brings the authoritative row.
async function confirmBudget(tx: WriteTransaction, view: Budget): Promise<void> {
  const store = tx.objectStore("budgets");
  const record = await store.get(view.id);
  if (!record) return;
  await store.put(
    budgetRecord({
      ...record.row,
      name: view.name,
      color: view.color,
      categoryIds: view.categoryIds,
      type: view.type,
      currency: view.currency,
      amount: view.baseAmount,
      periodType: view.periodType,
      effectiveFrom: view.effectiveFrom,
      note: view.note,
      archivedAt: view.archivedAt,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }),
  );
}

// The key an override hangs on, resolved the way the server resolves it: same rules, same zone.
async function periodKeyOf(
  tx: WriteTransaction,
  budget: SyncBudget,
  reference: string,
): Promise<string> {
  const record = await tx.objectStore("profile").get(PROFILE_KEY);
  if (!record) throw new NotProjectableError("a budget period without the profile's time zone");
  return resolvePeriod(budget, new Date(reference), record.row.timezone).key;
}

async function projectBudget(
  tx: WriteTransaction,
  id: string,
  next: SyncBudget,
): Promise<LocalChange> {
  const store = tx.objectStore("budgets");
  const previous = await store.get(id);
  await store.put(budgetRecord(next));
  const guarded = previous !== undefined && !(await unsent(tx, "budget", id));
  // A budget created offline can name categories created offline in the same session.
  const dependsOn = await dependenciesOf(
    tx,
    next.categoryIds.map((categoryId) => ({ entity: "category" as const, id: categoryId })),
  );
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn,
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("budgets");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

// The screen asks for a view, and building one needs the categories and the movements of the
// period: `spent` is derived, not stored. The reference is the one the caller was looking at.
const readBack =
  (id: string, reference?: string) =>
  async (db: VaultDb): Promise<Budget> => {
    const view = await mirrorBudget(db, id, reference);
    if (!view) throw new NotProjectableError(`budget ${id} after queueing it`);
    return view;
  };

export function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const id = input.id ?? newEntityId();
  const body: CreateBudgetInput = { ...input, id };
  return write<Budget>({
    local: {
      entity: "budget",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const { userId, currency } = await projectionContext(tx, occurredAt);
        return projectBudget(tx, id, {
          id,
          name: body.name,
          color: body.color,
          categoryIds: body.categoryIds,
          type: body.type ?? "EXPENSE",
          currency,
          amount: body.amount,
          amountOverrides: {},
          periodType: body.periodType,
          periodStartDate: body.periodStartDate ?? null,
          periodEndDate: body.periodEndDate ?? null,
          effectiveFrom: body.effectiveFrom ?? null,
          note: body.note ?? null,
          userId,
          archivedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      },
    },
    send: () => api<Budget>("/budgets", { method: "POST", body }),
    confirm: async (tx, result) => {
      await confirmBudget(tx, result);
    },
    optimistic: readBack(id),
  });
}

export function updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget> {
  return write<Budget>({
    local: {
      entity: "budget",
      entityId: id,
      action: "update",
      payload: { body: input },
      project: async (tx) => projectBudget(tx, id, patch(await currentRow(tx, id), input)),
    },
    send: (guard) =>
      api<Budget>(`/budgets/${id}`, { method: "PUT", body: input, ...ifMatch(guard) }),
    confirm: async (tx, result) => {
      await confirmBudget(tx, result);
    },
    optimistic: readBack(id),
  });
}

export function archiveBudget(id: string): Promise<unknown> {
  return write<unknown>({
    local: {
      entity: "budget",
      entityId: id,
      action: "archive",
      payload: {},
      project: async (tx, occurredAt) =>
        projectBudget(tx, id, { ...(await currentRow(tx, id)), archivedAt: occurredAt }),
    },
    send: (guard) => api<unknown>(`/budgets/${id}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: () => undefined,
    optimistic: () => null,
  });
}

export function restoreBudget(id: string, reference?: string): Promise<Budget> {
  return write<Budget>({
    local: {
      entity: "budget",
      entityId: id,
      action: "restore",
      payload: { ...(reference ? { query: { reference } } : {}) },
      project: async (tx) =>
        projectBudget(tx, id, { ...(await currentRow(tx, id)), archivedAt: null }),
    },
    send: (guard) =>
      api<Budget>(`/budgets/${id}/restore`, {
        method: "POST",
        query: { reference },
        ...ifMatch(guard),
      }),
    confirm: async (tx, result) => {
      await confirmBudget(tx, result);
    },
    optimistic: readBack(id, reference),
  });
}

export function setBudgetOverride(id: string, reference: string, amount: number): Promise<Budget> {
  return write<Budget>({
    local: {
      entity: "budget",
      entityId: id,
      action: "setOverride",
      payload: { query: { reference }, body: { amount } satisfies BudgetAmountOverrideInput },
      project: async (tx) => {
        const current = await currentRow(tx, id);
        return projectBudget(tx, id, {
          ...current,
          amountOverrides: {
            ...current.amountOverrides,
            [await periodKeyOf(tx, current, reference)]: amount,
          },
        });
      },
    },
    send: (guard) =>
      api<Budget>(`/budgets/${id}/amount`, {
        method: "PUT",
        query: { reference },
        body: { amount } satisfies BudgetAmountOverrideInput,
        ...ifMatch(guard),
      }),
    confirm: async (tx, result) => {
      await confirmBudget(tx, result);
    },
    optimistic: readBack(id, reference),
  });
}

export function removeBudgetOverride(id: string, reference: string): Promise<Budget> {
  return write<Budget>({
    local: {
      entity: "budget",
      entityId: id,
      action: "clearOverride",
      payload: { query: { reference } },
      project: async (tx) => {
        const current = await currentRow(tx, id);
        const key = await periodKeyOf(tx, current, reference);
        const amountOverrides = Object.fromEntries(
          Object.entries(current.amountOverrides).filter(([period]) => period !== key),
        );
        return projectBudget(tx, id, { ...current, amountOverrides });
      },
    },
    send: (guard) =>
      api<Budget>(`/budgets/${id}/amount`, {
        method: "DELETE",
        query: { reference },
        ...ifMatch(guard),
      }),
    confirm: async (tx, result) => {
      await confirmBudget(tx, result);
    },
    optimistic: readBack(id, reference),
  });
}
