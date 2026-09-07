import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { AmountInput } from "./AmountInput";

describe("AmountInput", () => {
  it("uses a numeric keyboard for currencies without decimals", () => {
    renderWithProviders(<AmountInput onChange={vi.fn()} label="Amount" />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute("inputmode", "numeric");
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
});
