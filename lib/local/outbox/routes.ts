import { api } from "@/lib/api/client";
import type {
  Account,
  Budget,
  BudgetAmountOverrideInput,
  Category,
  SyncBudget,
  SyncTransaction,
  Transaction,
} from "@/types/api";

import type { OutboxEntity, OutboxOperation } from "../schema";
import type { OperationPayload, OutboxAction } from "./envelope";
import type { WriteTransaction } from "./queue";
import { reconcileRemoval, reconcileRow } from "./reconcile";
import type { MirrorRow } from "./reproject";

// What the server needs to refuse a write made against a row it has already moved on from (O-B2).
// Absent for a create and for a row the queue has not put on the server yet: guarding against an
// `updatedAt` the server never printed would be a 409 on every attempt.
export interface WriteGuard {
  ifMatch?: string;
}

const ifMatch = (guard: WriteGuard) =>
  guard.ifMatch ? { headers: { "If-Match": guard.ifMatch } } : {};

// Everything a route needs to rebuild its request. The engine replays operations it did not queue —
// after a reload the closures are gone — so `body` and `query` are kept in the envelope verbatim.
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

// The one cast in the table: a route knows the shape it sends and the shape it is answered with,
// and the registry that holds all of them together cannot.
function route<R>(spec: {
  send: (ref: OperationRef, guard: WriteGuard) => Promise<R>;
  confirm?: (tx: WriteTransaction, result: R, operation: OutboxOperation) => Promise<void> | void;
}): Route {
  return {
    send: spec.send,
    confirm: (tx, result, operation) => spec.confirm?.(tx, result as R, operation),
  };
}

// An archive answers the row since F-22 (backend `7e4edb4`), which is what lets the engine rebase
// the guard of a restore queued behind it. The guard stays: `transaction:delete` answers a message.
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

// The view the API answers with drops what only the stored row carries — the override map, the
// CUSTOM dates, the owner — so the server's reply is merged over the baseline the mirror kept
// instead of replacing it, and the next pull brings the authoritative row.
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

// How a row the server sent enters the mirror, by entity rather than by route: the row becomes the
// baseline and what the queue still holds for it is projected back on top (D-24).
export async function serverBaseline(
  tx: WriteTransaction,
  entity: OutboxEntity,
  raw: unknown,
): Promise<MirrorRow | undefined> {
  if (entity === "budget") return budgetBaseline(tx, raw as Budget);
  if (entity === "transaction") return toSyncRow(raw as Transaction);
  return raw as Account | Category;
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

// One entry per route the outbox covers. Both callers go through it: the write that queues the
// operation and the engine that replays it later, so there is a single description of each request.
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
