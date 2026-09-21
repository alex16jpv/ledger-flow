import { currencyFractionDigits } from "@/lib/format/currency";
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

export const PERCENT_SCALE = 100;
export const WHOLE = PERCENT_SCALE * PERCENT_SCALE;

// The server adds percentages as basis points; in floats three thirds of 100 do not make 100.
export const basisPoints = (percent: number): number => Math.round(percent * PERCENT_SCALE);

export function percentLeft(typed: Iterable<number | null | undefined>): number {
  let assigned = 0;
  for (const percent of typed) assigned += basisPoints(percent ?? 0);
  return WHOLE - assigned;
}

// Added in minor units and divided once: in majors a currency with cents leaves -1.42e-14 behind.
export function leftToAssign(
  draft: SplitDraft,
  parties: readonly SplitParty[],
  total: number,
  currency: string,
): number {
  const scale = 10 ** currencyFractionDigits(currency);
  const minor = (amount: number) => Math.round(amount * scale);
  const totalMinor = minor(total);
  if (draft.mode === "EQUAL") return 0;
  if (draft.mode === "PERCENT") {
    return (
      Math.round(
        (totalMinor * percentLeft(parties.map((party) => inputOf(draft, party.key)))) / WHOLE,
      ) / scale
    );
  }
  const typed = parties.reduce((sum, party) => sum + minor(inputOf(draft, party.key) ?? 0), 0);
  if (draft.mode === "EXACT") return (totalMinor - typed) / scale;
  // Fixed plus rest: whoever is not pinned takes what is left, unless nobody is or it is already gone.
  const pinned = parties.filter((party) => inputOf(draft, party.key) !== null);
  if (pinned.length === parties.length) return (totalMinor - typed) / scale;
  return Math.min(0, totalMinor - typed) / scale;
}

export type SplitProblem = "SHORT" | "OVER" | "NOBODY_TAKES_THE_REST" | "NEGATIVE" | "MISSING";

// Why the sheet cannot be saved, in the words of the thing that is actually wrong.
export function splitProblem(
  draft: SplitDraft,
  parties: readonly SplitParty[],
  left: number,
): SplitProblem {
  if (parties.some((party) => (inputOf(draft, party.key) ?? 0) < 0)) return "NEGATIVE";
  if (draft.mode === "FIXED_REST") {
    if (parties.every((party) => inputOf(draft, party.key) !== null)) {
      return "NOBODY_TAKES_THE_REST";
    }
    return left < 0 ? "OVER" : "SHORT";
  }
  if (draft.mode !== "EQUAL" && parties.some((party) => inputOf(draft, party.key) === null)) {
    return "MISSING";
  }
  return left < 0 ? "OVER" : "SHORT";
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
