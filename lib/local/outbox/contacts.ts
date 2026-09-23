import type { Contact, CreateContactInput, RestoreInput, UpdateContactInput } from "@/types/api";

import { contactRecord } from "../schema";
import { newEntityId } from "./envelope";
import { NotProjectableError, patch, projectionContext } from "./projected";
import { type LocalChange, unsent, type VaultDb, type WriteTransaction } from "./queue";
import { write } from "./write";

// The server answers an email it never got as absent, not as null: the mirror says the same.
const emailField = (email: string | null | undefined): Partial<Contact> => (email ? { email } : {});

function applyUpdate(row: Contact, input: UpdateContactInput): Contact {
  const next = patch(row, { name: input.name, color: input.color });
  if (input.email === null || input.email === "") delete next.email;
  else if (input.email !== undefined) next.email = input.email;
  return next;
}

async function currentRow(tx: WriteTransaction, id: string): Promise<Contact> {
  const record = await tx.objectStore("contacts").get(id);
  if (!record) throw new NotProjectableError(`contact ${id}, which the mirror does not hold`);
  return record.row;
}

async function projectContact(
  tx: WriteTransaction,
  id: string,
  next: Contact,
): Promise<LocalChange> {
  const store = tx.objectStore("contacts");
  const previous = await store.get(id);
  // D-24: the server's version rides along; a row created here is its own baseline for now.
  await store.put(contactRecord(next, previous ? (previous.server ?? previous.row) : next));
  const guarded = previous !== undefined && !(await unsent(tx, "contact", id));
  return {
    ...(guarded ? { baseUpdatedAt: previous.updatedAt } : {}),
    dependsOn: [],
    undo: async (undoTx) => {
      const undone = undoTx.objectStore("contacts");
      if (previous) await undone.put(previous);
      else await undone.delete(id);
    },
  };
}

const readBack =
  (id: string) =>
  async (db: VaultDb): Promise<Contact> => {
    const record = await db.get("contacts", id);
    if (!record) throw new NotProjectableError(`contact ${id} after queueing it`);
    return record.row;
  };

export function createContact(input: CreateContactInput): Promise<Contact> {
  const id = input.id ?? newEntityId();
  const body: CreateContactInput = { ...input, id };
  return write<Contact>({
    local: {
      entity: "contact",
      entityId: id,
      action: "create",
      payload: { body },
      project: async (tx, occurredAt) => {
        const { userId } = await projectionContext(tx, occurredAt);
        return projectContact(tx, id, {
          id,
          name: body.name,
          color: body.color ?? null,
          ...emailField(body.email),
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

export function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  return write<Contact>({
    local: {
      entity: "contact",
      entityId: id,
      action: "update",
      payload: { body: input },
      project: async (tx) => projectContact(tx, id, applyUpdate(await currentRow(tx, id), input)),
    },
    optimistic: readBack(id),
  });
}

// A contact is archived, never deleted: the groups and the payments that name it stay readable.
export function archiveContact(id: string): Promise<unknown> {
  return write<unknown>({
    local: {
      entity: "contact",
      entityId: id,
      action: "archive",
      payload: {},
      project: async (tx, occurredAt) =>
        projectContact(tx, id, { ...(await currentRow(tx, id)), archivedAt: occurredAt }),
    },
    optimistic: () => null,
  });
}

export function restoreContact(id: string, input: RestoreInput = {}): Promise<Contact> {
  return write<Contact>({
    local: {
      entity: "contact",
      entityId: id,
      action: "restore",
      payload: { body: input },
      project: async (tx) =>
        projectContact(tx, id, patch({ ...(await currentRow(tx, id)), archivedAt: null }, input)),
    },
    optimistic: readBack(id),
  });
}
