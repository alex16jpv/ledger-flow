import { fromCents, toCents } from "@/lib/local/derive/money";
import type { Account } from "@/types/api";

export const DEBT_ACCOUNT_TYPES: ReadonlySet<Account["type"]> = new Set([
  "CARD",
  "OVERDRAFT",
  "LOAN",
]);

export type DebtField = "creditLimit" | "borrowedAmount";

export function debtFieldOf(type: Account["type"]): DebtField | null {
  if (type === "CARD" || type === "OVERDRAFT") return "creditLimit";
  if (type === "LOAN") return "borrowedAmount";
  return null;
}

export type DebtFoot =
  | { line: "owedOfLimit"; owed: number; limit: number }
  | { line: "paidOfBorrowed"; paid: number; borrowed: number }
  | { line: "inCredit"; amount: number };

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
    return {
      lead: 0,
      word: "owed",
      bar: scale === null ? null : 0,
      foot: { line: "inCredit", amount: fromCents(-owed) },
      missing,
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
