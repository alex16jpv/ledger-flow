import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import { CodeField } from "./CodeField";
import { Field } from "./Field";

function Harness({ error, onFilled }: { error?: string; onFilled?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <Field label="6-digit code" error={error}>
      <CodeField value={value} onChange={setValue} onFilled={onFilled} />
    </Field>
  );
}

const cells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[aria-hidden="true"] > span')).map(
    (cell) => cell.textContent,
  );

describe("CodeField", () => {
  it("is one labelled input the phone can fill with the code it received", () => {
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText("6-digit code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).not.toHaveAttribute("maxlength");
  });

  it("keeps only digits and stops at six", async () => {
    const { container } = renderWithProviders(<Harness />);
    const input = screen.getByLabelText("6-digit code");
    await userEvent.type(input, "4a8 2-71955");
    expect(input).toHaveValue("482719");
    expect(cells(container)).toEqual(["4", "8", "2", "7", "1", "9"]);
  });

  it("fills all six from a paste with a space or a dash, and says so", async () => {
    const onFilled = vi.fn();
    renderWithProviders(<Harness onFilled={onFilled} />);
    const input = screen.getByLabelText("6-digit code");
    await userEvent.click(input);
    await userEvent.paste("482 719");
    expect(input).toHaveValue("482719");
    expect(onFilled).toHaveBeenCalledTimes(1);
  });

  it("never moves on while the digits are typed", async () => {
    const onFilled = vi.fn();
    renderWithProviders(<Harness onFilled={onFilled} />);
    await userEvent.type(screen.getByLabelText("6-digit code"), "482719");
    expect(onFilled).not.toHaveBeenCalled();
  });

  it("takes the last digit back with Backspace", async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText("6-digit code");
    await userEvent.type(input, "4827{Backspace}");
    expect(input).toHaveValue("482");
  });

  it("points at its error and marks itself invalid", () => {
    renderWithProviders(<Harness error="That code doesn’t work." />);
    const input = screen.getByLabelText("6-digit code");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("That code doesn’t work.");
  });
});
