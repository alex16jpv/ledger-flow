import { screen, within } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AccountRowCard } from "./AccountCard";

const account = (over: Partial<Account>): Account => ({
  id: "visa",
  name: "Visa Gold",
  type: "CARD",
  balance: -1245900,
  openingBalance: 0,
  color: "PURPLE",
  userId: "u1",
  isDefault: false,
  currency: "COP",
  archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("AccountRowCard", () => {
  it("leads a card with what is available and carries the debt under the bar", () => {
    renderWithProviders(<AccountRowCard account={account({ creditLimit: 4000000 })} href="/a" />);

    expect(screen.getByText("2,754,100")).toBeInTheDocument();
    expect(screen.getByText("available · Credit card")).toBeInTheDocument();
    expect(screen.getByText("$1,245,900 owed of $4,000,000")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Credit limit in use" })).toHaveAttribute(
      "aria-valuenow",
      "0.311475",
    );
  });

  it("leads a loan with what is owed and fills its bar with what is paid", () => {
    renderWithProviders(
      <AccountRowCard
        account={account({ type: "LOAN", balance: -8400000, borrowedAmount: 12000000 })}
        href="/a"
      />,
    );

    expect(screen.getByText("8,400,000")).toBeInTheDocument();
    expect(screen.getByText("owed · Loan")).toBeInTheDocument();
    expect(screen.getByText("$3,600,000 paid of $12,000,000")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Paid off" })).toBeInTheDocument();
  });

  it("asks for the field its type has, and only while it is empty", () => {
    const { unmount } = renderWithProviders(
      <AccountRowCard account={account({})} href="/a" promptHref="/a/edit" />,
    );

    const prompt = screen.getByRole("link", { name: "Set a credit limit" });
    expect(prompt).toHaveAttribute("href", "/a/edit");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <AccountRowCard account={account({ creditLimit: 4000000 })} href="/a" promptHref="/a/edit" />,
    );
    expect(screen.queryByRole("link", { name: "Set a credit limit" })).not.toBeInTheDocument();
  });

  it("asks a loan for the amount borrowed, never for a credit limit", () => {
    renderWithProviders(
      <AccountRowCard
        account={account({ type: "LOAN", balance: -8400000 })}
        href="/a"
        promptHref="/a/edit"
      />,
    );

    expect(screen.getByRole("link", { name: "Set the amount borrowed" })).toBeInTheDocument();
  });

  it("keeps the whole card openable when the prompt sits on it", () => {
    renderWithProviders(
      <AccountRowCard account={account({})} href="/accounts/visa" promptHref="/a/edit" />,
    );

    expect(screen.getByRole("link", { name: "Visa Gold" })).toHaveAttribute(
      "href",
      "/accounts/visa",
    );
  });

  it("names money of the owner's own on a debt account instead of calling it a debt", () => {
    renderWithProviders(<AccountRowCard account={account({ balance: 4000000 })} href="/a" />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("$4,000,000 of your own money sitting on it")).toBeInTheDocument();
  });

  it("names the bar after the type, not after what the account happens to lead with", () => {
    renderWithProviders(
      <AccountRowCard account={account({ balance: 500000, creditLimit: 4000000 })} href="/a" />,
    );

    expect(screen.getByRole("progressbar", { name: "Credit limit in use" })).toBeInTheDocument();
  });

  it("marks the bar and its line as a projection, not only the headline", () => {
    renderWithProviders(
      <AccountRowCard account={account({ creditLimit: 4000000 })} href="/a" projected />,
    );

    expect(screen.getAllByRole("img", { name: "Includes changes not yet synced" })).toHaveLength(2);
  });

  it("leaves an account that is not debt exactly as it was", () => {
    renderWithProviders(
      <AccountRowCard account={account({ type: "ACCOUNT", balance: 3420500 })} href="/a" />,
    );

    const card = screen.getByRole("link", { name: /Bank account/ });
    expect(within(card).getByText("3,420,500")).toBeInTheDocument();
    expect(within(card).getByText("Bank account")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
