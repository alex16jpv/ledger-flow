import { fromCents, toCents } from "@/lib/local/derive/money";
import type { Account } from "@/types/api";

export const DEBT_ACCOUNT_TYPES: ReadonlySet<Account["type"]> = new Set([
  "CARD",
  "OVERDRAFT",
  "LOAN",
]);

// An overdraft holds its owner's money in its ordinary state, so a salary landing there is income (T-93).
export const INCOME_REFUSED_TYPES: ReadonlySet<Account["type"]> = new Set(["CARD", "LOAN"]);

export function loanOwed(account: Pick<Account, "type" | "balance"> | null): number | null {
  return account !== null && account.type === "LOAN" ? Math.max(0, -account.balance) : null;
}

export type DebtField = "creditLimit" | "borrowedAmount";

export function debtFieldOf(type: Account["type"]): DebtField | null {
  if (type === "CARD" || type === "OVERDRAFT") return "creditLimit";
  if (type === "LOAN") return "borrowedAmount";
  return null;
}

export function mayHoldOwnMoney(type: Account["type"]): boolean {
  return debtFieldOf(type) !== "borrowedAmount";
}

export type DebtFoot =
  | { line: "owedOfLimit"; owed: number; limit: number }
  | { line: "paidOfBorrowed"; paid: number; borrowed: number }
  | { line: "inCredit"; amount: number }
  | { line: "inCreditOfLimit"; owed: number; limit: number; own: number };

export interface DebtReading {
  lead: number;
  word: "available" | "owed";
  bar: number | null;
  foot: DebtFoot | null;
  missing: DebtField | null;
}

export type DebtAccount = Pick<Account, "type" | "balance" | "creditLimit" | "borrowedAmount">;

const clamp = (fraction: number): number => Math.min(1, Math.max(0, fraction));

export function readDebt(account: DebtAccount): DebtReading | null {
  const field = debtFieldOf(account.type);
  if (field === null) return null;

  const scaleAmount = account[field];
  const scale = scaleAmount !== undefined && scaleAmount > 0 ? toCents(scaleAmount) : null;
  const missing = scale === null ? field : null;
  const owed = 0 - toCents(account.balance);

  if (owed < 0) {
    const own = -owed;
    if (!mayHoldOwnMoney(account.type)) {
      return {
        lead: 0,
        word: "owed",
        bar: scale === null ? null : 1,
        foot:
          scale === null
            ? null
            : { line: "paidOfBorrowed", paid: fromCents(scale), borrowed: fromCents(scale) },
        missing,
      };
    }
    if (scale === null) {
      return {
        lead: 0,
        word: "owed",
        bar: null,
        foot: { line: "inCredit", amount: fromCents(own) },
        missing,
      };
    }
    return {
      lead: fromCents(scale + own),
      word: "available",
      bar: 0,
      foot: { line: "inCreditOfLimit", owed: 0, limit: fromCents(scale), own: fromCents(own) },
      missing: null,
    };
  }

  if (scale === null) {
    return { lead: fromCents(owed), word: "owed", bar: null, foot: null, missing: field };
  }

  if (field === "borrowedAmount") {
    const paid = Math.max(0, scale - owed);
    return {
      lead: fromCents(owed),
      word: "owed",
      bar: clamp(paid / scale),
      foot: { line: "paidOfBorrowed", paid: fromCents(paid), borrowed: fromCents(scale) },
      missing: null,
    };
  }

  return {
    lead: fromCents(Math.max(0, scale - owed)),
    word: "available",
    bar: clamp(owed / scale),
    foot: { line: "owedOfLimit", owed: fromCents(owed), limit: fromCents(scale) },
    missing: null,
  };
}

export interface AccountsSplit {
  have: number;
  owe: number;
}

export function splitAccounts(accounts: readonly Account[]): AccountsSplit {
  let have = 0;
  let owe = 0;
  for (const account of accounts) {
    const cents = toCents(account.balance);
    if (DEBT_ACCOUNT_TYPES.has(account.type) && cents < 0) owe -= cents;
    else have += cents;
  }
  return { have: fromCents(have), owe: fromCents(owe) };
}
