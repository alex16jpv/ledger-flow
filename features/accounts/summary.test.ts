import type { Account } from "@/types/api";

import { findActiveByName, summarizeAccounts } from "./summary";

function account(id: string, extra: Partial<Account>): Account {
  return {
    id,
    name: id,
    type: "ACCOUNT",
    balance: 0,
    openingBalance: 0,
    color: "BLUE",
    userId: "u1",
    isDefault: false,
    currency: "COP",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const accounts = [
  account("cash", { type: "CASH", balance: 184_000 }),
  account("banco", { balance: 3_420_500, isDefault: true }),
  account("visa", { type: "CARD", balance: -1_245_900 }),
  account("loan", { type: "LOAN", balance: 500_000 }),
  account("nequi", { type: "OTHER", balance: 900, archivedAt: "2026-01-01T00:00:00Z" }),
];

describe("summarizeAccounts", () => {
  it("splits active and archived, puts the main account first and sums only active balances", () => {
    const summary = summarizeAccounts(accounts);
    expect(summary.active.map((a) => a.id)).toEqual(["banco", "cash", "visa", "loan"]);
    expect(summary.archived.map((a) => a.id)).toEqual(["nequi"]);
    expect(summary.totalBalance).toBe(184_000 + 3_420_500 - 1_245_900 + 500_000);
  });

  it("counts as card debt only the negative balances of card, overdraft and loan accounts", () => {
    expect(summarizeAccounts(accounts).cardDebt).toBe(-1_245_900);
    expect(summarizeAccounts([account("neg", { type: "CASH", balance: -5 })]).cardDebt).toBe(0);
  });
});

describe("findActiveByName", () => {
  it("matches case-insensitively and ignores archived accounts", () => {
    expect(findActiveByName(accounts, "  CASH ")?.id).toBe("cash");
    expect(findActiveByName(accounts, "nequi")).toBeUndefined();
  });
});
