import { api } from "@/lib/api/client";
import type { Account, CreateAccountInput, RestoreInput, UpdateAccountInput } from "@/types/api";

import { accountRecord } from "../schema";
import { newEntityId } from "./envelope";
import { NotProjectableError, patch, projectionContext } from "./projected";
import { type LocalChange, unsent, type VaultDb, type WriteTransaction } from "./queue";
import { write, type WriteGuard } from "./write";

const ifMatch = (guard: WriteGuard) =>
  guard.ifMatch ? { headers: { "If-Match": guard.ifMatch } } : {};

async function currentRow(tx: WriteTransaction, id: string): Promise<Account> {
  const record = await tx.objectStore("accounts").get(id);
  if (!record) throw new NotProjectableError(`account ${id}, which the mirror does not hold`);
  return record.row;
}

// Puts the projected row in the mirror and hands back what undoes it. The guard is the mirror's
// `updatedAt`, and only while the server has already seen the row: a row still waiting for its own
// create carries a stamp the server never printed.
async function projectAccount(
  tx: WriteTransaction,
  id: string,
  next: Account,
): Promise<LocalChange> {
  const store = tx.objectStore("accounts");
  const previous = await store.get(id);
  await store.put(accountRecord(next));
  const guarded = previous !== undefined && !(await unsent(tx, "account", id));
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn: [],
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("accounts");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

const readBack =
  (id: string) =>
  async (db: VaultDb): Promise<Account> => {
    const record = await db.get("accounts", id);
    if (!record) throw new NotProjectableError(`account ${id} after queueing it`);
    return record.row;
  };

export function createAccount(input: CreateAccountInput): Promise<Account> {
  const id = input.id ?? newEntityId();
  const body: CreateAccountInput = { ...input, id };
  return write<Account>({
    local: {
      entity: "account",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const { userId, currency } = await projectionContext(tx, occurredAt);
        // The server derives both figures from the single `balance` the form sends, and makes the
        // first account the default one. Every one of these is a projection until it answers.
        const isDefault = (await tx.objectStore("accounts").count()) === 0;
        return projectAccount(tx, id, {
          id,
          name: body.name,
          type: body.type,
          balance: body.balance,
          openingBalance: body.balance,
          color: body.color ?? null,
          userId,
          isDefault,
          currency,
          archivedAt: null,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
      },
    },
    // O-B1: a create carrying an id is already idempotent, so the header would be redundant.
    send: () => api<Account>("/accounts", { method: "POST", body }),
    confirm: async (tx, result) => {
      await tx.objectStore("accounts").put(accountRecord(result));
    },
    optimistic: readBack(id),
  });
}

export function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  return write<Account>({
    local: {
      entity: "account",
      entityId: id,
      action: "update",
      payload: { body: input },
      project: async (tx) => projectAccount(tx, id, patch(await currentRow(tx, id), input)),
    },
    send: (guard) =>
      api<Account>(`/accounts/${id}`, { method: "PUT", body: input, ...ifMatch(guard) }),
    confirm: async (tx, result) => {
      await tx.objectStore("accounts").put(accountRecord(result));
    },
    optimistic: readBack(id),
  });
}

export function archiveAccount(id: string): Promise<unknown> {
  return write<unknown>({
    local: {
      entity: "account",
      entityId: id,
      action: "archive",
      payload: {},
      project: async (tx, occurredAt) =>
        projectAccount(tx, id, { ...(await currentRow(tx, id)), archivedAt: occurredAt }),
    },
    send: (guard) => api<unknown>(`/accounts/${id}`, { method: "DELETE", ...ifMatch(guard) }),
    confirm: () => undefined,
    optimistic: () => null,
  });
}

export function restoreAccount(id: string, input: RestoreInput = {}): Promise<Account> {
  return write<Account>({
    local: {
      entity: "account",
      entityId: id,
      action: "restore",
      payload: { body: input },
      project: async (tx) =>
        projectAccount(tx, id, patch({ ...(await currentRow(tx, id)), archivedAt: null }, input)),
    },
    send: (guard) =>
      api<Account>(`/accounts/${id}/restore`, { method: "POST", body: input, ...ifMatch(guard) }),
    confirm: async (tx, result) => {
      await tx.objectStore("accounts").put(accountRecord(result));
    },
    optimistic: readBack(id),
  });
}

export function setDefaultAccount(id: string): Promise<Account> {
  return write<Account>({
    local: {
      entity: "account",
      entityId: id,
      action: "setDefault",
      payload: {},
      project: async (tx) => {
        // The server moves the flag, so the mirror moves it too: leaving two defaults would make
        // quick capture pick the wrong account for as long as the operation is queued.
        const store = tx.objectStore("accounts");
        const demoted = (await store.getAll()).filter(
          (record) => record.row.isDefault && record.id !== id,
        );
        for (const record of demoted) {
          await store.put(accountRecord({ ...record.row, isDefault: false }));
        }
        const change = await projectAccount(tx, id, {
          ...(await currentRow(tx, id)),
          isDefault: true,
        });
        return {
          ...change,
          undo: async (undoTx) => {
            for (const record of demoted) await undoTx.objectStore("accounts").put(record);
            await change.undo(undoTx);
          },
        };
      },
    },
    send: (guard) => api<Account>(`/accounts/${id}/default`, { method: "POST", ...ifMatch(guard) }),
    confirm: async (tx, result) => {
      await tx.objectStore("accounts").put(accountRecord(result));
    },
    optimistic: readBack(id),
  });
}
