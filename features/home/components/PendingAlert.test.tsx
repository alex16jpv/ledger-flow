import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { PendingAlert } from "./PendingAlert";

describe("PendingAlert", () => {
  // T-106: one sum of every amount added the income to the expenses and read $1,227,900.
  it("says what went out and what came in, each in its own colour", () => {
    renderWithProviders(<PendingAlert count={3} expense={27_900} income={1_200_000} />);

    const alert = screen.getByRole("link", { name: /3 quick entries to review/ });
    expect(alert).toHaveAttribute("href", "/transactions/review");
    expect(alert).toHaveTextContent("3 quick entries to review · −$27,900 · +$1,200,000");
    expect(screen.getByText("−27,900")).toHaveClass("text-text");
    expect(screen.getByText("+1,200,000")).toHaveClass("text-income");
  });

  it("keeps the symbol in the figure's colour, which the amber holds and the muted grey does not", () => {
    renderWithProviders(<PendingAlert count={2} expense={27_900} income={0} />);

    const alert = screen.getByRole("link", { name: /2 quick entries to review/ });
    expect(alert).toHaveTextContent(/^2 quick entries to review · −\$27,900$/);
    expect(alert.querySelector(".text-text-3")).toBeNull();
  });

  it("leaves out a direction with nothing in it", () => {
    renderWithProviders(<PendingAlert count={1} expense={0} income={45_000} />);

    const alert = screen.getByRole("link", { name: /1 quick entry to review/ });
    expect(alert).toHaveTextContent(/^1 quick entry to review · \+\$45,000$/);
  });

  it("says only the count when what waits moved nothing in or out", () => {
    renderWithProviders(<PendingAlert count={1} expense={0} income={0} />);

    expect(screen.getByRole("link", { name: /1 quick entry to review/ })).toHaveTextContent(
      /^1 quick entry to review$/,
    );
  });
});
