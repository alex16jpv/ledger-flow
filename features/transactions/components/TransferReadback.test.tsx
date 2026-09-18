import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { sideKey, TransferReadback } from "./TransferReadback";

const account = (name: string, type: Account["type"], balance = -1_245_900) => ({
  name,
  type,
  balance,
});

describe("the sentence that reads a transfer back", () => {
  it("says each side in the vocabulary of the account it names", () => {
    expect(sideKey(account("Bancolombia", "ACCOUNT", 3_420_500), false)).toBe("leaves");
    expect(sideKey(account("Savings", "SAVINGS", 8_900_000), true)).toBe("arrives");
    expect(sideKey(account("Visa Gold", "CARD"), true)).toBe("lessOwed");
    expect(sideKey(account("Visa Gold", "CARD"), false)).toBe("moreOwed");
    expect(sideKey(account("Car loan", "LOAN"), true)).toBe("lessOwed");
    expect(sideKey(account("Overdraft", "OVERDRAFT"), false)).toBe("moreOwed");
  });

  // Every card in the product is in this state until the one-off script of T-90 has run.
  it("owes nothing on a card holding money of your own, and says so with a sign", () => {
    expect(sideKey(account("Visa Gold", "CARD", 100_000), true)).toBe("arrives");
    expect(sideKey(account("Visa Gold", "CARD", 100_000), false)).toBe("leaves");
    expect(sideKey(account("Car loan", "LOAN", 0), true)).toBe("arrives");

    renderWithProviders(
      <TransferReadback
        from={account("Bancolombia", "ACCOUNT", 3_420_500)}
        to={account("Visa Gold", "CARD", 100_000)}
        amount={50_000}
      />,
    );
    expect(screen.getByText(/Bancolombia −\$50,000 · Visa Gold \+\$50,000/)).toBeVisible();
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

  // T-100: money from outside has no second side, and it is neither income nor spending.
  it("reads a payment from outside with one side only", () => {
    renderWithProviders(
      <TransferReadback from={null} to={account("Visa Gold", "CARD")} amount={500000} outside />,
    );
    expect(screen.getByText(/Visa Gold \$500,000 less owed/)).toHaveTextContent(
      "It does not count as income or as spending, because the money never was in Ledger Flow.",
    );
  });

  it("says the one side in its own vocabulary, so a card holding your money takes a sign", () => {
    renderWithProviders(
      <TransferReadback
        from={null}
        to={account("Visa Gold", "CARD", 100_000)}
        amount={50_000}
        outside
      />,
    );
    expect(screen.getByText(/Visa Gold \+\$50,000/)).toBeVisible();
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
