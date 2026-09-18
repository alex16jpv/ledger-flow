import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { InstalmentReadback } from "./InstalmentReadback";

const bank = { name: "Bancolombia", type: "ACCOUNT" as Account["type"], balance: 3_420_500 };
const loan = { name: "Car loan", type: "LOAN" as Account["type"], balance: -8_400_000 };

function render(over: Partial<React.ComponentProps<typeof InstalmentReadback>> = {}) {
  return renderWithProviders(
    <InstalmentReadback
      from={bank}
      to={loan}
      instalment={420_000}
      interest={126_000}
      interestCategory="Interest"
      {...over}
    />,
  );
}

describe("the sentence that reads a loan instalment back", () => {
  it("names what leaves, what the debt drops by, and what the interest is", () => {
    render();

    expect(
      screen.getByText(
        "Bancolombia −$420,000 · Car loan $294,000 less owed. $126,000 of that is spending: it shows in Stats under Interest.",
      ),
    ).toBeVisible();
  });

  it("lists the two movements it is about to write, with their own amounts", () => {
    render();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("To Car loan");
    expect(rows[0]).toHaveTextContent("Transfer · lowers the loan");
    expect(rows[0]).toHaveTextContent("$294,000");
    expect(rows[1]).toHaveTextContent("Interest on Car loan");
    expect(rows[1]).toHaveTextContent("Expense · Interest");
    expect(rows[1]).toHaveTextContent("$126,000");
  });

  it("says nothing about a state until a half has one", () => {
    render();

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Refused")).not.toBeInTheDocument();
  });

  it("announces the half that arrived, and marks which is which", () => {
    render({ transfer: "saved", expense: "refused" });

    const said = screen.getByRole("alert");
    expect(said).toHaveTextContent("Only half of this arrived.");
    expect(said).toHaveTextContent("The payment of $294,000 is on the server");
    expect(said).toHaveTextContent("the interest of $126,000 was refused");
    expect(screen.getByText("Saved")).toBeVisible();
    expect(screen.getByText("Refused")).toBeVisible();
  });

  it("goes back to the plain sentence once both halves are saved", () => {
    render({ transfer: "saved", expense: "saved" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/of that is spending/)).toBeVisible();
  });

  it("says the side it names in the vocabulary of its own account", () => {
    render({ to: { ...loan, type: "ACCOUNT", balance: 100 } });

    expect(screen.getByText(/Car loan \+\$294,000/)).toBeVisible();
  });
});
