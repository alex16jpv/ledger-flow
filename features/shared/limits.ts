import type { SharedLimits } from "@/types/api";

// The numbers live in the generated contract's literal types, so a change there fails this file.
const LIMITS: SharedLimits = {
  maxContactsPerUser: 200,
  maxParticipantsPerGroup: 20,
  maxPendingInvitationsPerUser: 50,
  invitationLifetimeDays: 30,
  maxGuestsPerExpense: 999,
};

export const MAX_CONTACTS = LIMITS.maxContactsPerUser;
export const MAX_PARTICIPANTS = LIMITS.maxParticipantsPerGroup;
export const MAX_GUESTS = LIMITS.maxGuestsPerExpense;
export const MAX_WAITING_INVITATIONS = LIMITS.maxPendingInvitationsPerUser;
export const INVITATION_DAYS = LIMITS.invitationLifetimeDays;
