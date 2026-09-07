import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Segment } from "./Segment";

const options = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income", tone: "income" as const },
] as const;

describe("Segment", () => {
  it("marks the selected option and reports changes", async () => {
    const onChange = vi.fn();
    render(<Segment options={options} value="EXPENSE" onChange={onChange} label="Type" />);
    expect(screen.getByRole("group", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expense" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(onChange).toHaveBeenCalledWith("INCOME");
  });
});
