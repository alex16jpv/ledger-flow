import { api } from "@/lib/api/client";
import type {
  ReceivedInvitation,
  ReceivedInvitationList,
  SentInvitation,
  SentInvitationList,
} from "@/types/api";

import { serverNow } from "../clock";
import { receivedInvitationRecord, sentInvitationRecord } from "../schema";
import { currentVault, read } from "./read";

const PAGE_LIMIT = 100;

async function drain<T extends { id: string }>(path: string): Promise<T[]> {
  const data: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<{
      data: T[];
      pagination: { hasMore: boolean; nextCursor: string | null };
    }>(path, { query: { limit: PAGE_LIMIT, cursor } });
    data.push(...page.data);
    const next = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
    if (next !== undefined && next === cursor) throw new Error(`${path} kept paging in place`);
    cursor = next;
  } while (cursor);
  return data;
}

// Nothing marks the moment an invitation runs out, so its date is read against the server's clock.
export function isAnswerable(
  invitation: Pick<ReceivedInvitation | SentInvitation, "status" | "expiresAt">,
  now: number = serverNow(),
): boolean {
  return invitation.status === "PENDING" && Date.parse(invitation.expiresAt) > now;
}

// Every invitation addressed to this person that the device holds, answered ones included.
export function readReceivedInvitations(): Promise<ReceivedInvitation[]> {
  return read<ReceivedInvitation[]>(
    () => drain<ReceivedInvitationList["data"][number]>("/invitations"),
    async (db) => (await db.getAll("invitationsReceived")).map((record) => record.row),
  );
}

export function readGroupInvitations(groupId: string): Promise<SentInvitation[]> {
  return read<SentInvitation[]>(
    () => drain<SentInvitationList["data"][number]>(`/shared-groups/${groupId}/invitations`),
    async (db) =>
      (await db.getAll("invitationsSent"))
        .map((record) => record.row)
        .filter((row) => row.groupId === groupId),
  );
}

// An answer from the server is the row the next pull would bring; keeping it now spares the wait.
export async function keepSentInvitation(row: SentInvitation): Promise<void> {
  await currentVault()?.db.put("invitationsSent", sentInvitationRecord(row));
}

export async function keepReceivedInvitation(row: ReceivedInvitation): Promise<void> {
  await currentVault()?.db.put("invitationsReceived", receivedInvitationRecord(row));
}
