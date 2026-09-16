import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AccountsSection } from "./AccountsSection";

function account(id: string, name: string, extra: Partial<Account> = {}): Account {
  return {
    id,
    name,
    type: "ACCOUNT",
    balance: 0,
    openingBalance: 0,
    color: "BLUE",
    userId: "u1",
    isDefault: false,
    currency: "COP",
    archivedAt: null,
    createdAt: "2026-03-12T12:00:00Z",
    updatedAt: "2026-03-12T12:00:00Z",
    ...extra,
  };
}

describe("AccountsSection", () => {
  it("opens each account's detail and puts the main one first", () => {
    renderWithProviders(
      <AccountsSection
        accounts={[
          account("cash", "Cash", { type: "CASH", balance: 184_000 }),
          account("banco", "Bancolombia", { balance: 3_420_500, isDefault: true }),
        ]}
      />,
    );

    const cards = screen.getAllByRole("link", { name: /Bancolombia|Cash/ });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Bancolombia");
    expect(cards[0]).toHaveTextContent("Main");
    expect(cards[0]).toHaveAttribute("href", "/accounts/banco");
    expect(cards[1]).toHaveTextContent("Cash");
    expect(cards[1]).toHaveAttribute("href", "/accounts/cash");

    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/accounts");
  });
});
