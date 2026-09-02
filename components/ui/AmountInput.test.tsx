import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { AmountInput } from "./AmountInput";

describe("AmountInput", () => {
  it("uses a numeric keyboard for currencies without decimals", () => {
    renderWithProviders(<AmountInput onChange={vi.fn()} label="Amount" />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute("inputmode", "numeric");
  });

  it("parses a decimal comma in Spanish", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole("textbox", { name: "Importe" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await userEvent.type(input, "1.284,50");
    expect(onChange).toHaveBeenLastCalledWith(1284.5);
  });

  it("reports null when cleared and on garbage", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput defaultValue={42} onChange={onChange} label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toHaveValue("42");
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.type(input, "1..2");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
