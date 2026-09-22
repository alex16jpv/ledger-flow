import { render, screen } from "@testing-library/react";

import { renderWithProviders } from "@/lib/testing/render";

import { Field } from "./Field";
import { Picker } from "./Picker";

describe("Picker", () => {
  it("shows the placeholder when empty and the value otherwise", () => {
    const { rerender } = render(<Picker label="Account" placeholder="Choose an account" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByText("Choose an account").className).toContain("text-text-3");
    rerender(<Picker label="Account" placeholder="Choose an account" value="Bancolombia" />);
    expect(screen.getByText("Bancolombia").className).toContain("font-medium");
  });

  it("is described by the help and the error of the field it is in", () => {
    renderWithProviders(
      <Field label="Currency" help="What your money is in" error="Choose a currency.">
        <Picker label="Currency" placeholder="Choose" />
      </Field>,
    );

    const described = screen.getByRole("button").getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(described).toHaveLength(2);
    for (const id of described) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
    expect(screen.getByText("What your money is in")).toHaveAttribute("id", described[0]);
    // The field's label would rename the button, so the picker never takes its id.
    expect(screen.getByRole("button", { name: /Currency/ })).toBeInTheDocument();
  });

  it("lets an explicit description win over the field's", () => {
    renderWithProviders(
      <Field label="Currency" help="What your money is in">
        <Picker label="Currency" placeholder="Choose" aria-describedby="mine" />
      </Field>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "mine");
  });
});
