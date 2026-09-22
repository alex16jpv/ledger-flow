import { api } from "@/lib/api/client";
import {
  type ContactListParams,
  keepReceivedInvitation,
  keepSentInvitation,
  readContact,
  readContacts,
  readContactsPage,
  readGroupInvitations,
  readReceivedInvitations,
  readSharedLedger,
  type SharedLedgerRows,
} from "@/lib/local/repository";
import type {
  AddParticipantsInput,
  AddParticipantsPreview,
  Contact,
  ContactList,
  ReceivedInvitation,
  SentInvitation,
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

export function fetchReceivedInvitations(): Promise<ReceivedInvitation[]> {
  return readReceivedInvitations();
}

export function fetchGroupInvitations(groupId: string): Promise<SentInvitation[]> {
  return readGroupInvitations(groupId);
}

// Every invitation write is about somebody else, so none of them waits in the queue.
export async function inviteToGroup(groupId: string, contactId: string): Promise<SentInvitation> {
  const row = await api<SentInvitation>(`/shared-groups/${groupId}/invitations`, {
    method: "POST",
    body: { contactId },
  });
  await keepSentInvitation(row);
  return row;
}

export async function withdrawInvitation(
  groupId: string,
  invitationId: string,
): Promise<SentInvitation> {
  const row = await api<SentInvitation>(`/shared-groups/${groupId}/invitations/${invitationId}`, {
    method: "DELETE",
  });
  await keepSentInvitation(row);
  return row;
}

export async function answerInvitation(
  id: string,
  answer: "accept" | "decline",
): Promise<ReceivedInvitation> {
  const row = await api<ReceivedInvitation>(`/invitations/${id}/${answer}`, { method: "POST" });
  await keepReceivedInvitation(row);
  return row;
}
