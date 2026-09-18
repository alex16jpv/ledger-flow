import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { TypeLine } from "./TypeLine";

describe("the line that says what a type is", () => {
  it("says the selected type, with the three left inside the sheet", () => {
    const { container } = renderWithProviders(<TypeLine type="EXPENSE" />);
    expect(container.querySelector("p")).toHaveTextContent(
      "Money leaving one of your accounts and not coming back.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the three explained side by side, as rows that lead nowhere", async () => {
    renderWithProviders(<TypeLine type="TRANSFER" />);
    await userEvent.click(screen.getByRole("button", { name: "What the three types mean" }));

    const sheet = screen.getByRole("dialog", { name: "What the three types mean" });
    expect(within(sheet).getByText("Expense")).toBeVisible();
    expect(within(sheet).getByText("Income")).toBeVisible();
    expect(within(sheet).getByText("Money arriving into one of your accounts.")).toBeVisible();
    expect(within(sheet).queryAllByRole("link")).toHaveLength(0);
    expect(
      within(sheet).queryAllByRole("button", { name: /Expense|Income|Transfer/ }),
    ).toHaveLength(0);
  });
});
