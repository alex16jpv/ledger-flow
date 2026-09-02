import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { Field, Input, Switch } from "./Field";

describe("Field", () => {
  it("links label, help and error to the control", () => {
    renderWithProviders(
      <Field label="Email" optional help="We never share it" error="Invalid email">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
    expect(screen.getByText("optional")).toBeInTheDocument();
  });

  it("switch toggles with role=switch", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Switch checked={false} onCheckedChange={onChange} label="Only quick" />);
    await userEvent.click(screen.getByRole("switch", { name: "Only quick" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
