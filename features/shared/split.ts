import { resolveShares, type SplitMode, type SplitRow } from "@/lib/local/derive";
import type { ColorToken } from "@/lib/theme/feature-color";
import type { SharedShare, SharedSplit } from "@/types/api";

export const SPLIT_MODES = ["EQUAL", "PERCENT", "EXACT", "FIXED_REST"] as const;
export const GROUP_SPLIT_MODES = ["EQUAL", "PERCENT"] as const;

export const USER_KEY = "user";
export const GUESTS_KEY = "guests";

export interface SplitParty {
  key: string;
  party: SharedShare["party"];
  contactId: string | null;
  name: string;
  color: ColorToken | null;
  // One for a person; the head count for the block of guests, which weighs as many shares.
  units: number;
}

export interface SplitDraft {
  mode: SplitMode;
  guests: { count: number; name: string | null } | null;
  // Per party: the percentage, the exact amount, or the pinned amount of a fixed-plus-rest split.
  inputs: Record<string, number | null>;
}

export const emptyDraft = (mode: SplitMode = "EQUAL"): SplitDraft => ({
  mode,
  guests: null,
  inputs: {},
});

export function partiesOf(
  people: Omit<SplitParty, "units" | "party" | "key">[],
  guests: SplitDraft["guests"],
): SplitParty[] {
  const rows: SplitParty[] = people.map((person) => ({
    key: person.contactId ?? USER_KEY,
    party: person.contactId === null ? "USER" : "CONTACT",
    contactId: person.contactId,
    name: person.name,
    color: person.color,
    units: 1,
  }));
  if (guests && guests.count > 0) {
    rows.push({
      key: GUESTS_KEY,
      party: "GUESTS",
      contactId: null,
      name: guests.name ?? "",
      color: "GRAY",
      units: guests.count,
    });
  }
  return rows;
}

const inputOf = (draft: SplitDraft, key: string): number | null => draft.inputs[key] ?? null;

const rowsOf = (draft: SplitDraft, parties: readonly SplitParty[]): SplitRow[] =>
  parties.map((party) => ({
    units: party.units,
    input: draft.mode === "EQUAL" ? null : inputOf(draft, party.key),
  }));

// What the sheet shows under the rows, and what it refuses to be saved with.
export function leftToAssign(
  draft: SplitDraft,
  parties: readonly SplitParty[],
  total: number,
): number {
  if (draft.mode === "EQUAL") return 0;
  const typed = parties.reduce((sum, party) => sum + (inputOf(draft, party.key) ?? 0), 0);
  if (draft.mode === "PERCENT") return total - (total * typed) / 100;
  if (draft.mode === "EXACT") return total - typed;
  // Fixed plus rest: whoever is not pinned takes what is left, unless nobody is.
  const pinned = parties.filter((party) => inputOf(draft, party.key) !== null);
  return pinned.length === parties.length ? total - typed : 0;
}

export function splitInputOf(
  draft: SplitDraft,
  parties: readonly SplitParty[],
): NonNullable<SharedSplit> {
  return {
    mode: draft.mode,
    guests: draft.guests,
    shares: parties.map((party) => ({
      party: party.party,
      contactId: party.contactId,
      percent: draft.mode === "PERCENT" ? inputOf(draft, party.key) : null,
      fixedAmount:
        draft.mode === "EXACT" || draft.mode === "FIXED_REST" ? inputOf(draft, party.key) : null,
      amount: 0,
      collected: 0,
    })),
  };
}

// The same arithmetic the server runs, so a split made with no network agrees with it to the unit.
export function resolveDraft(
  draft: SplitDraft,
  parties: readonly SplitParty[],
  total: number,
  currency: string,
  payerKey: string,
): SharedShare[] {
  const payerIndex = Math.max(
    0,
    parties.findIndex((party) => party.key === payerKey),
  );
  const amounts = resolveShares({
    total,
    currency,
    mode: draft.mode,
    rows: rowsOf(draft, parties),
    payerIndex,
  });
  const split = splitInputOf(draft, parties);
  return split.shares.map((share, index) => ({ ...share, amount: amounts[index] ?? 0 }));
}
