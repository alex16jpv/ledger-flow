import { api } from "@/lib/api/client";
import type { Contact, ContactList } from "@/types/api";

import type { ContactRecord } from "../schema";
import { mirrorPage, read } from "./read";

export const CONTACT_PAGE_LIMIT = 100;

export interface ContactListParams {
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

function listQuery(params: ContactListParams, cursor = params.cursor) {
  return {
    includeArchived: params.includeArchived ? "true" : undefined,
    limit: params.limit ?? CONTACT_PAGE_LIMIT,
    cursor,
  };
}

async function drain(params: ContactListParams): Promise<Contact[]> {
  const data: Contact[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<ContactList>("/contacts", { query: listQuery(params, cursor) });
    data.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return data;
}

function matching(records: ContactRecord[], params: ContactListParams): Contact[] {
  return records
    .filter((record) => params.includeArchived === true || record.archived === 0)
    .map((record) => record.row);
}

// A cursor naming no row is a 400 on the server, so the mirror hands the question over instead.
function after(rows: Contact[], cursor: string | undefined): Contact[] | undefined {
  if (cursor === undefined) return rows;
  const at = rows.findIndex((row) => row.id === cursor);
  return at === -1 ? undefined : rows.slice(at + 1);
}

// Reference data, like the categories: the picker pages, and everything else wants every name.
export function readContacts(params: ContactListParams = {}): Promise<Contact[]> {
  return read<Contact[]>(
    () => drain(params),
    async (db) => matching(await db.getAll("contacts"), params),
  );
}

export function readContactsPage(params: ContactListParams = {}): Promise<ContactList> {
  const limit = params.limit ?? CONTACT_PAGE_LIMIT;
  return read<ContactList>(
    () => api<ContactList>("/contacts", { query: listQuery(params) }),
    async (db) => {
      const all = matching(await db.getAll("contacts"), params);
      const rows = after(all, params.cursor);
      return rows && mirrorPage(rows, limit, all.length);
    },
  );
}

// The API answers the archived ones too, so the mirror does not filter here either.
export function readContact(id: string): Promise<Contact> {
  return read<Contact>(
    () => api<Contact>(`/contacts/${id}`),
    async (db) => (await db.get("contacts", id))?.row,
  );
}
