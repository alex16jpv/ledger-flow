import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import { AmountInput } from "./AmountInput";
import { Field } from "./Field";

describe("AmountInput", () => {
  it("uses a numeric keyboard for currencies without decimals", () => {
    renderWithProviders(<AmountInput onChange={vi.fn()} label="Amount" />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute("inputmode", "numeric");
  });

  it("refuses a decimal under a zero-decimal currency, whatever the device thinks", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Amount" />, { currency: "COP" });
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Amount" });
    await userEvent.type(input, "1000.50");
    expect(input).toHaveValue("100,050");
    expect(onChange).toHaveBeenLastCalledWith(100050);
  });

  it("groups thousands while typing and reports the clean number", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Amount" />);
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Amount" });
    await userEvent.type(input, "1234567");
    expect(input).toHaveValue("1,234,567");
    expect(onChange).toHaveBeenLastCalledWith(1234567);
    expect(input.selectionStart).toBe(9);
  });

  it("parses a decimal comma in Spanish and shows the Spanish grouping", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole("textbox", { name: "Importe" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await userEvent.type(input, "1284,5");
    expect(input).toHaveValue("1.284,5");
    expect(onChange).toHaveBeenLastCalledWith(1284.5);
    await userEvent.type(input, "09");
    expect(input).toHaveValue("1.284,50");
  });

  it("keeps the caret next to the digit the user edited", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Amount" />);
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Amount" });
    await userEvent.type(input, "1234");
    input.setSelectionRange(1, 1);
    await userEvent.keyboard("9");
    expect(input).toHaveValue("19,234");
    expect(input.selectionStart).toBe(2);
    input.setSelectionRange(3, 3);
    await userEvent.keyboard("{Backspace}");
    expect(input).toHaveValue("1,234");
    expect(onChange).toHaveBeenLastCalledWith(1234);
  });

  it("formats the initial value, strips letters and reports null when cleared", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput defaultValue={18400} onChange={onChange} label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toHaveValue("18,400");
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.type(input, "12abc");
    expect(input).toHaveValue("12");
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("paints an amount its field rejects, and points at the reason", () => {
    renderWithProviders(
      <Field label="Amount to pay" error="A loan cannot be paid more than it owes.">
        <AmountInput onChange={vi.fn()} label="Amount to pay" defaultValue={9000} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Amount to pay" });
    expect(input).toHaveClass("text-danger");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("A loan cannot be paid more than it owes.").getAttribute("id")).toBe(
      input.getAttribute("aria-describedby"),
    );
  });

  it("takes a figure written from outside, and does not fight what is being typed", async () => {
    function Host() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <AmountInput value={value} onChange={setValue} label="Amount to pay" />
          <button
            type="button"
            onClick={() => {
              setValue(1245900);
            }}
          >
            Everything owed
          </button>
        </>
      );
    }
    renderWithProviders(<Host />);
    const input = screen.getByRole("textbox", { name: "Amount to pay" });

    await userEvent.type(input, "3000");
    expect(input).toHaveValue("3,000");

    await userEvent.click(screen.getByRole("button", { name: "Everything owed" }));
    expect(input).toHaveValue("1,245,900");

    await userEvent.type(input, "0");
    expect(input).toHaveValue("12,459,000");
  });

  it("takes the id of the field around it, so its visible label reaches the input", () => {
    renderWithProviders(
      <Field label="Amount to pay">
        <AmountInput onChange={vi.fn()} label="Amount to pay" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Amount to pay" });
    const label = screen.getByText("Amount to pay", { selector: "label span" }).closest("label");
    expect(label).toHaveAttribute("for", input.getAttribute("id"));
  });

  it("takes a second size, for an amount that sits beside the one a screen is about", () => {
    const { rerender } = renderWithProviders(
      <AmountInput onChange={vi.fn()} label="Amount to pay" />,
    );
    expect(screen.getByRole("textbox", { name: "Amount to pay" })).toHaveClass("text-[52px]");

    rerender(<AmountInput onChange={vi.fn()} label="Amount to pay" size="sm" />);
    const small = screen.getByRole("textbox", { name: "Amount to pay" });
    expect(small).toHaveClass("text-[28px]");
    expect(small).not.toHaveClass("text-[52px]");
  });
});
