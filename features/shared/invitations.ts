import { isAnswerable } from "@/lib/local/repository";
import type { SentInvitation } from "@/types/api";

export type InviteState = "noEmail" | "notInvited" | "waiting" | "expired" | "joined" | "declined";

export interface PersonInvite {
  state: InviteState;
  invitation: SentInvitation | null;
}

// The newest invitation to a person is the one that says where they stand.
export function latestByContact(
  invitations: readonly SentInvitation[],
): Map<string, SentInvitation> {
  const latest = new Map<string, SentInvitation>();
  for (const invitation of invitations) {
    const seen = latest.get(invitation.contactId);
    if (!seen || invitation.createdAt > seen.createdAt)
      latest.set(invitation.contactId, invitation);
  }
  return latest;
}

export function inviteStateOf(
  email: string | undefined,
  invitation: SentInvitation | undefined,
  now?: number,
): PersonInvite {
  if (invitation?.status === "ACCEPTED") return { state: "joined", invitation };
  if (!email) return { state: "noEmail", invitation: null };
  if (!invitation || invitation.status === "WITHDRAWN") {
    return { state: "notInvited", invitation: null };
  }
  if (invitation.status === "DECLINED") return { state: "declined", invitation };
  return isAnswerable(invitation, now)
    ? { state: "waiting", invitation }
    : { state: "expired", invitation };
}
