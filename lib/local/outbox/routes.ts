import { api } from "@/lib/api/client";
import type {
  Account,
  AddParticipantsResult,
  Budget,
  BudgetAmountOverrideInput,
  Category,
  Contact,
  SettlementResult,
  SharedExpense,
  SharedGroup,
  SyncBudget,
  SyncSharedGroup,
  SyncTransaction,
  Transaction,
} from "@/types/api";

import type { OutboxEntity, OutboxOperation } from "../schema";
import { type OperationPayload, operationPayload, type OutboxAction } from "./envelope";
import type { WriteTransaction } from "./queue";
import { reconcileRemoval, reconcileRow } from "./reconcile";
import type { MirrorRow } from "./reproject";

// O-B2: absent for a create and an unsent row — guarding an unprinted `updatedAt` is a 409.
export interface WriteGuard {
  ifMatch?: string;
}

const ifMatch = (guard: WriteGuard) =>
  guard.ifMatch ? { headers: { "If-Match": guard.ifMatch } } : {};

// The engine replays operations it did not queue, so `body` and `query` are kept verbatim.
export interface OperationRef {
  entityId: string;
  payload: OperationPayload;
}

export interface Route {
  send: (ref: OperationRef, guard: WriteGuard) => Promise<unknown>;
  confirm: (
    tx: WriteTransaction,
    result: unknown,
    operation: OutboxOperation,
  ) => Promise<void> | void;
}

// The one cast in the table: the registry holding every route cannot know each one's shapes.
function route<R>(spec: {
  send: (ref: OperationRef, guard: WriteGuard) => Promise<R>;
  confirm?: (tx: WriteTransaction, result: R, operation: OutboxOperation) => Promise<void> | void;
}): Route {
  return {
    send: spec.send,
    confirm: (tx, result, operation) => spec.confirm?.(tx, result as R, operation),
  };
}

// F-22 (backend `7e4edb4`): an archive answers the row, but `transaction:delete` a message.
const isRow = (result: unknown): result is { id: string; updatedAt: string } =>
  typeof result === "object" &&
  result !== null &&
  typeof (result as { id?: unknown }).id === "string" &&
  typeof (result as { updatedAt?: unknown }).updatedAt === "string";

// The API's transaction has no `deletedAt`; the mirror's row always does.
const toSyncRow = (row: Transaction): SyncTransaction => ({
  ...row,
  deletedAt: (row as { deletedAt?: string | null }).deletedAt ?? null,
});

// The API's view drops the override map, the CUSTOM dates and the owner, so it is merged over.
async function budgetBaseline(tx: WriteTransaction, view: Budget): Promise<SyncBudget | undefined> {
  const record = await tx.objectStore("budgets").get(view.id);
  if (!record) return undefined;
  return {
    ...(record.server ?? record.row),
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
  };
}

// An expense with no group in its path would be sent to `/shared-groups/undefined/expenses`.
function groupOf(payload: OperationPayload): string {
  const groupId = payload.params?.groupId;
  if (!groupId) throw new Error("a shared expense with no group in its path");
  return groupId;
}

function partyOf(payload: OperationPayload): string {
  const partyId = payload.params?.partyId;
  if (!partyId) throw new Error("a shared group write with nobody in its path");
  return partyId;
}

async function dropMinted(tx: WriteTransaction, operation: OutboxOperation): Promise<void> {
  const store = tx.objectStore("transactions");
  for (const id of operationPayload(operation).minted ?? []) await store.delete(id);
}

// D-24: the row becomes the baseline and what the queue holds is projected back on top.
export async function serverBaseline(
  tx: WriteTransaction,
  entity: OutboxEntity,
  raw: unknown,
): Promise<MirrorRow | undefined> {
  if (entity === "budget") return budgetBaseline(tx, raw as Budget);
  if (entity === "transaction") return toSyncRow(raw as Transaction);
  // The group's view adds `totals` and `status`, which are derived on every read and never stored.
  if (entity === "sharedGroup") {
    const view = raw as SharedGroup;
    const row: Record<string, unknown> = { ...view };
    delete row.totals;
    delete row.status;
    return row as SyncSharedGroup;
  }
  return raw as Account | Category | Contact | SharedExpense;
}

async function confirmRow(tx: WriteTransaction, entity: OutboxEntity, raw: unknown): Promise<void> {
  const baseline = await serverBaseline(tx, entity, raw);
  if (baseline) await reconcileRow(tx, entity, baseline.id, baseline);
}

// A removal the server confirmed without the row: the baseline moves the way the operation asked.
const confirmRemoval = (
  tx: WriteTransaction,
  result: unknown,
  operation: OutboxOperation,
): Promise<void> =>
  isRow(result) ? confirmRow(tx, operation.entity, result) : reconcileRemoval(tx, operation);

export type RouteKey = { [E in OutboxEntity]: `${E}:${OutboxAction<E>}` }[OutboxEntity];

// Both callers go through it — the write and the engine — so each request is described once.
export const ROUTES: Record<RouteKey, Route> = {
  "account:create": route<Account>({
    // O-B1: a create carrying an id is already idempotent, so the header would be redundant.
    send: ({ payload }) => api<Account>("/accounts", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "account", row),
  }),
  "account:update": route<Account>({
    send: ({ entityId, payload }, guard) =>
      api<Account>(`/accounts/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "account", row),
  }),
  "account:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/accounts/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: confirmRemoval,
  }),
  "account:restore": route<Account>({
    send: ({ entityId, payload }, guard) =>
      api<Account>(`/accounts/${entityId}/restore`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "account", row),
  }),
  "account:setDefault": route<Account>({
    send: ({ entityId }, guard) =>
      api<Account>(`/accounts/${entityId}/default`, { method: "POST", ...ifMatch(guard) }),
    confirm: (tx, row) => confirmRow(tx, "account", row),
  }),

  "category:create": route<Category>({
    send: ({ payload }) => api<Category>("/categories", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "category", row),
  }),
  "category:update": route<Category>({
    send: ({ entityId, payload }, guard) =>
      api<Category>(`/categories/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "category", row),
  }),
  "category:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/categories/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: confirmRemoval,
  }),
  "category:restore": route<Category>({
    send: ({ entityId, payload }, guard) =>
      api<Category>(`/categories/${entityId}/restore`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "category", row),
  }),

  "contact:create": route<Contact>({
    send: ({ payload }) => api<Contact>("/contacts", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "contact", row),
  }),
  "contact:update": route<Contact>({
    send: ({ entityId, payload }, guard) =>
      api<Contact>(`/contacts/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "contact", row),
  }),
  "contact:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/contacts/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: confirmRemoval,
  }),
  "contact:restore": route<Contact>({
    send: ({ entityId, payload }, guard) =>
      api<Contact>(`/contacts/${entityId}/restore`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "contact", row),
  }),

  "transaction:create": route<Transaction>({
    send: ({ payload }) =>
      api<Transaction>("/transactions", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "transaction", row),
  }),
  "transaction:quickAdd": route<Transaction>({
    send: ({ payload }) =>
      api<Transaction>("/transactions/quick", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "transaction", row),
  }),
  "transaction:update": route<Transaction>({
    send: ({ entityId, payload }, guard) =>
      api<Transaction>(`/transactions/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "transaction", row),
  }),
  "transaction:delete": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/transactions/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: (tx, _result, operation) => reconcileRemoval(tx, operation),
  }),

  "sharedGroup:create": route<SharedGroup>({
    send: ({ payload }) =>
      api<SharedGroup>("/shared-groups", { method: "POST", body: payload.body }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:update": route<SharedGroup>({
    send: ({ entityId, payload }, guard) =>
      api<SharedGroup>(`/shared-groups/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:restore": route<SharedGroup>({
    send: ({ entityId }, guard) =>
      api<SharedGroup>(`/shared-groups/${entityId}/restore`, { method: "POST", ...ifMatch(guard) }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:addParticipants": route<AddParticipantsResult>({
    send: ({ entityId, payload }, guard) =>
      api<AddParticipantsResult>(`/shared-groups/${entityId}/participants`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, result) =>
      isRow(result.group) ? confirmRow(tx, "sharedGroup", result.group) : undefined,
  }),
  "sharedGroup:removeParticipant": route<SharedGroup>({
    send: ({ entityId, payload }, guard) =>
      api<SharedGroup>(`/shared-groups/${entityId}/participants/${partyOf(payload)}`, {
        method: "DELETE",
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:writeOff": route<SharedGroup>({
    send: ({ entityId, payload }, guard) =>
      api<SharedGroup>(`/shared-groups/${entityId}/write-offs`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:undoWriteOff": route<SharedGroup>({
    send: ({ entityId, payload }, guard) =>
      api<SharedGroup>(`/shared-groups/${entityId}/write-offs/${partyOf(payload)}`, {
        method: "DELETE",
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedGroup", row),
  }),
  "sharedGroup:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/shared-groups/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: confirmRemoval,
  }),

  "settlement:create": route<SettlementResult>({
    send: ({ payload }) =>
      api<SettlementResult>("/settlements", { method: "POST", body: payload.body }),
    confirm: async (tx, result, operation) => {
      await dropMinted(tx, operation);
      await confirmRow(tx, "settlement", result.settlement);
    },
  }),
  "settlement:delete": route<unknown>({
    send: ({ entityId }) => api<unknown>(`/settlements/${entityId}`, { method: "DELETE" }),
    confirm: confirmRemoval,
  }),

  "sharedExpense:create": route<SharedExpense>({
    send: ({ payload }) =>
      api<SharedExpense>(`/shared-groups/${groupOf(payload)}/expenses`, {
        method: "POST",
        body: payload.body,
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedExpense", row),
  }),
  "sharedExpense:update": route<SharedExpense>({
    send: ({ entityId, payload }, guard) =>
      api<SharedExpense>(`/shared-groups/${groupOf(payload)}/expenses/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: (tx, row) => confirmRow(tx, "sharedExpense", row),
  }),

  "budget:create": route<Budget>({
    send: ({ payload }) => api<Budget>("/budgets", { method: "POST", body: payload.body }),
    confirm: (tx, view) => confirmRow(tx, "budget", view),
  }),
  "budget:update": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}`, { method: "PUT", body: payload.body, ...ifMatch(guard) }),
    confirm: (tx, view) => confirmRow(tx, "budget", view),
  }),
  "budget:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/budgets/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: confirmRemoval,
  }),
  "budget:restore": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/restore`, {
        method: "POST",
        query: payload.query,
        ...ifMatch(guard),
      }),
    confirm: (tx, view) => confirmRow(tx, "budget", view),
  }),
  "budget:setOverride": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/amount`, {
        method: "PUT",
        query: payload.query,
        body: payload.body as BudgetAmountOverrideInput,
        ...ifMatch(guard),
      }),
    confirm: (tx, view) => confirmRow(tx, "budget", view),
  }),
  "budget:clearOverride": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/amount`, {
        method: "DELETE",
        query: payload.query,
        ...ifMatch(guard),
      }),
    confirm: (tx, view) => confirmRow(tx, "budget", view),
  }),
};

export const routeFor = (entity: OutboxEntity, action: string): Route =>
  ROUTES[`${entity}:${action}` as RouteKey];
