import { api } from "@/lib/api/client";
import {
  type ContactListParams,
  readContact,
  readContacts,
  readContactsPage,
  readSharedLedger,
  type SharedLedgerRows,
} from "@/lib/local/repository";
import type {
  AddParticipantsInput,
  AddParticipantsPreview,
  Contact,
  ContactList,
} from "@/types/api";

// O-F4: reads go through the repository (mirror fallback); writes go through the outbox.
export {
  addParticipants,
  archiveContact,
  archiveSharedGroup,
  createContact,
  createSharedExpense,
  createSharedGroup,
  deleteSettlement,
  recordSettlement,
  removeParticipant,
  restoreContact,
  restoreSharedGroup,
  saveSharedSplit,
  undoWriteOff,
  updateContact,
  updateSharedGroup,
  writeOffParty,
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

// What adding them would do, worked out and thrown away: only the server can answer it.
export function previewParticipants(
  id: string,
  body: AddParticipantsInput,
): Promise<AddParticipantsPreview> {
  return api<AddParticipantsPreview>(`/shared-groups/${id}/participants/preview`, {
    method: "POST",
    body,
  });
}
