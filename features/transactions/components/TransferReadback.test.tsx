import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { sideKey, TransferReadback } from "./TransferReadback";

const account = (name: string, type: Account["type"]) => ({ name, type });

describe("the sentence that reads a transfer back", () => {
  it("says each side in the vocabulary of the account it names", () => {
    expect(sideKey(account("Bancolombia", "ACCOUNT"), false)).toBe("leaves");
    expect(sideKey(account("Savings", "SAVINGS"), true)).toBe("arrives");
    expect(sideKey(account("Visa Gold", "CARD"), true)).toBe("lessOwed");
    expect(sideKey(account("Visa Gold", "CARD"), false)).toBe("moreOwed");
    expect(sideKey(account("Car loan", "LOAN"), true)).toBe("lessOwed");
    expect(sideKey(account("Overdraft", "OVERDRAFT"), false)).toBe("moreOwed");
  });

  it("reads a card payment as a difference, never as a bigger balance", () => {
    renderWithProviders(
      <TransferReadback
        from={account("Bancolombia", "ACCOUNT")}
        to={account("Visa Gold", "CARD")}
        amount={500000}
      />,
    );
    expect(
      screen.getByText(/Bancolombia −\$500,000 · Visa Gold \$500,000 less owed/),
    ).toHaveTextContent("Your total balance does not change.");
  });

  it("reads money put aside with the plain signs", () => {
    renderWithProviders(
      <TransferReadback
        from={account("Bancolombia", "ACCOUNT")}
        to={account("Savings", "SAVINGS")}
        amount={300000}
      />,
    );
    expect(screen.getByText(/Bancolombia −\$300,000 · Savings \+\$300,000/)).toBeVisible();
  });

  it("reads a cash advance as more owed on the card", () => {
    renderWithProviders(
      <TransferReadback
        from={account("Visa Gold", "CARD")}
        to={account("Bancolombia", "ACCOUNT")}
        amount={200000}
      />,
    );
    expect(
      screen.getByText(/Visa Gold \$200,000 more owed · Bancolombia \+\$200,000/),
    ).toBeVisible();
  });

  it("says nothing until there is an amount and both sides", () => {
    const { container } = renderWithProviders(
      <TransferReadback from={account("Bancolombia", "ACCOUNT")} to={null} amount={500} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing for an amount that is not a figure yet", () => {
    const { container } = renderWithProviders(
      <TransferReadback
        from={account("Bancolombia", "ACCOUNT")}
        to={account("Savings", "SAVINGS")}
        amount={Number.NaN}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
