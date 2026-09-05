import { api } from "@/lib/api/client";
import type {
  Account,
  Budget,
  BudgetAmountOverrideInput,
  Category,
  Transaction,
} from "@/types/api";

import {
  accountRecord,
  budgetRecord,
  categoryRecord,
  type OutboxEntity,
  transactionRecord,
} from "../schema";
import type { OperationPayload, OutboxAction } from "./envelope";
import type { WriteTransaction } from "./queue";

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
  confirm: (tx: WriteTransaction, result: unknown) => Promise<void> | void;
}

// The one cast in the table: a route knows the shape it sends and the shape it is answered with,
// and the registry that holds all of them together cannot.
function route<R>(spec: {
  send: (ref: OperationRef, guard: WriteGuard) => Promise<R>;
  confirm?: (tx: WriteTransaction, result: R) => Promise<void> | void;
}): Route {
  return {
    send: spec.send,
    confirm: (tx, result) => spec.confirm?.(tx, result as R),
  };
}

// A removal keeps whatever the projection wrote: the archived row, the tombstone. Nothing to merge.
const nothing = undefined;

// An archive answers `{ message }` today (F-22). The day it answers the row, keeping it is what lets
// the engine rebase the guard of a restore queued behind it.
const isRow = (result: unknown): result is { id: string; updatedAt: string } =>
  typeof result === "object" &&
  result !== null &&
  typeof (result as { id?: unknown }).id === "string" &&
  typeof (result as { updatedAt?: unknown }).updatedAt === "string";

async function putAccount(tx: WriteTransaction, row: Account): Promise<void> {
  await tx.objectStore("accounts").put(accountRecord(row));
}

async function putCategory(tx: WriteTransaction, row: Category): Promise<void> {
  await tx.objectStore("categories").put(categoryRecord(row));
}

async function putTransaction(tx: WriteTransaction, row: Transaction): Promise<void> {
  await tx.objectStore("transactions").put(transactionRecord({ ...row, deletedAt: null }));
}

// The view the API answers with drops what only the stored row carries — the override map, the
// CUSTOM dates, the owner — so the server's reply is merged over the projection instead of
// replacing it, and the next pull brings the authoritative row.
async function mergeBudget(tx: WriteTransaction, view: Budget): Promise<void> {
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

export type RouteKey = { [E in OutboxEntity]: `${E}:${OutboxAction<E>}` }[OutboxEntity];

// One entry per route the outbox covers. Both callers go through it: the write that queues the
// operation and the engine that replays it later, so there is a single description of each request.
export const ROUTES: Record<RouteKey, Route> = {
  "account:create": route<Account>({
    // O-B1: a create carrying an id is already idempotent, so the header would be redundant.
    send: ({ payload }) => api<Account>("/accounts", { method: "POST", body: payload.body }),
    confirm: putAccount,
  }),
  "account:update": route<Account>({
    send: ({ entityId, payload }, guard) =>
      api<Account>(`/accounts/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: putAccount,
  }),
  "account:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/accounts/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: (tx, result) => (isRow(result) ? putAccount(tx, result as Account) : nothing),
  }),
  "account:restore": route<Account>({
    send: ({ entityId, payload }, guard) =>
      api<Account>(`/accounts/${entityId}/restore`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: putAccount,
  }),
  "account:setDefault": route<Account>({
    send: ({ entityId }, guard) =>
      api<Account>(`/accounts/${entityId}/default`, { method: "POST", ...ifMatch(guard) }),
    confirm: putAccount,
  }),

  "category:create": route<Category>({
    send: ({ payload }) => api<Category>("/categories", { method: "POST", body: payload.body }),
    confirm: putCategory,
  }),
  "category:update": route<Category>({
    send: ({ entityId, payload }, guard) =>
      api<Category>(`/categories/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: putCategory,
  }),
  "category:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/categories/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: (tx, result) => (isRow(result) ? putCategory(tx, result as Category) : nothing),
  }),
  "category:restore": route<Category>({
    send: ({ entityId, payload }, guard) =>
      api<Category>(`/categories/${entityId}/restore`, {
        method: "POST",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: putCategory,
  }),

  "transaction:create": route<Transaction>({
    send: ({ payload }) =>
      api<Transaction>("/transactions", { method: "POST", body: payload.body }),
    confirm: putTransaction,
  }),
  "transaction:quickAdd": route<Transaction>({
    send: ({ payload }) =>
      api<Transaction>("/transactions/quick", { method: "POST", body: payload.body }),
    confirm: putTransaction,
  }),
  "transaction:update": route<Transaction>({
    send: ({ entityId, payload }, guard) =>
      api<Transaction>(`/transactions/${entityId}`, {
        method: "PUT",
        body: payload.body,
        ...ifMatch(guard),
      }),
    confirm: putTransaction,
  }),
  "transaction:delete": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/transactions/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: nothing,
  }),

  "budget:create": route<Budget>({
    send: ({ payload }) => api<Budget>("/budgets", { method: "POST", body: payload.body }),
    confirm: mergeBudget,
  }),
  "budget:update": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}`, { method: "PUT", body: payload.body, ...ifMatch(guard) }),
    confirm: mergeBudget,
  }),
  "budget:archive": route<unknown>({
    send: ({ entityId }, guard) =>
      api<unknown>(`/budgets/${entityId}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: (tx, result) => (isRow(result) ? mergeBudget(tx, result as Budget) : nothing),
  }),
  "budget:restore": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/restore`, {
        method: "POST",
        query: payload.query,
        ...ifMatch(guard),
      }),
    confirm: mergeBudget,
  }),
  "budget:setOverride": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/amount`, {
        method: "PUT",
        query: payload.query,
        body: payload.body as BudgetAmountOverrideInput,
        ...ifMatch(guard),
      }),
    confirm: mergeBudget,
  }),
  "budget:clearOverride": route<Budget>({
    send: ({ entityId, payload }, guard) =>
      api<Budget>(`/budgets/${entityId}/amount`, {
        method: "DELETE",
        query: payload.query,
        ...ifMatch(guard),
      }),
    confirm: mergeBudget,
  }),
};

export const routeFor = (entity: OutboxEntity, action: string): Route =>
  ROUTES[`${entity}:${action}` as RouteKey];
