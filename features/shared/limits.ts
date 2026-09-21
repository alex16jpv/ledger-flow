import type { SharedLimits } from "@/types/api";

// The server's own bounds, as the contract states them: the sheets say them before a save can fail.
const LIMITS: SharedLimits = {
  maxContactsPerUser: 200,
  maxParticipantsPerGroup: 20,
  maxGuestsPerExpense: 999,
};

export const MAX_CONTACTS = LIMITS.maxContactsPerUser;
export const MAX_PARTICIPANTS = LIMITS.maxParticipantsPerGroup;
export const MAX_GUESTS = LIMITS.maxGuestsPerExpense;
