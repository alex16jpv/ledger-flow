import {
  type ContactListParams,
  readContact,
  readContacts,
  readContactsPage,
  readSharedLedger,
  type SharedLedgerRows,
} from "@/lib/local/repository";
import type { Contact, ContactList } from "@/types/api";

// O-F4: reads go through the repository (mirror fallback); writes go through the outbox.
export {
  archiveContact,
  createContact,
  createSharedExpense,
  createSharedGroup,
  restoreContact,
  saveSharedSplit,
  updateContact,
} from "@/lib/local/outbox";

export function fetchContacts(params: ContactListParams = {}): Promise<Contact[]> {
  return readContacts(params);
}

export function fetchContactsPage(params: ContactListParams = {}): Promise<ContactList> {
  return readContactsPage(params);
}

export function fetchContact(id: string): Promise<Contact> {
  return readContact(id);
}

export function fetchSharedLedger(): Promise<SharedLedgerRows> {
  return readSharedLedger();
}
