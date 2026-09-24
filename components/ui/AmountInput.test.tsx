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

  it("takes the point of a keyboard in English as the decimal of an app in Spanish", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole("textbox", { name: "Importe" });
    await userEvent.type(input, "1284.50");
    expect(input).toHaveValue("1.284,50");
    expect(onChange).toHaveBeenLastCalledWith(1284.5);
  });

  it("takes the comma of a keyboard in Spanish as the decimal of an app in English", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Amount" />, { currency: "USD" });
    const input = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.type(input, "12,5");
    expect(input).toHaveValue("12.5");
    expect(onChange).toHaveBeenLastCalledWith(12.5);
  });

  it("reads a thousands separator typed by hand as one once three digits follow it", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Amount" />, { currency: "USD" });
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Amount" });
    await userEvent.type(input, "1,250,000.75");
    expect(input).toHaveValue("1,250,000.75");
    expect(onChange).toHaveBeenLastCalledWith(1250000.75);
    expect(input.selectionStart).toBe(12);
  });

  it("reads a pasted figure whichever separator it was written with", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole("textbox", { name: "Importe" });
    await userEvent.click(input);
    await userEvent.paste("$1,284.50");
    expect(input).toHaveValue("1.284,5");
    expect(onChange).toHaveBeenLastCalledWith(1284.5);
    await userEvent.clear(input);
    await userEvent.paste("1.250");
    expect(input).toHaveValue("1.250");
    expect(onChange).toHaveBeenLastCalledWith(1250);
  });

  it("reads a separator typed first as the decimal of zero", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole("textbox", { name: "Importe" });
    await userEvent.type(input, ".50");
    expect(input).toHaveValue("0,50");
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it("takes a separator typed over the selected cents", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, {
      locale: "es",
      currency: "USD",
    });
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Importe" });
    await userEvent.type(input, "1234");
    input.setSelectionRange(2, 5);
    await userEvent.keyboard(".5");
    expect(input).toHaveValue("1,5");
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  it("reads a pasted figure with its symbol, and never a decimal the currency lacks", async () => {
    const onChange = vi.fn();
    renderWithProviders(<AmountInput onChange={onChange} label="Importe" />, { locale: "es" });
    const input = screen.getByRole("textbox", { name: "Importe" });
    await userEvent.click(input);
    await userEvent.paste("COP 12,500");
    expect(input).toHaveValue("12.500");
    expect(onChange).toHaveBeenLastCalledWith(12500);
  });

  it("forgets the typed separator when the parent writes a figure", async () => {
    function Host() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <AmountInput value={value} onChange={setValue} label="Amount" />
          <button
            type="button"
            onClick={() => {
              setValue(2.5);
            }}
          >
            Fill
          </button>
        </>
      );
    }
    renderWithProviders(<Host />, { currency: "USD" });
    const input = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.type(input, "1,5");
    await userEvent.click(screen.getByRole("button", { name: "Fill" }));
    await userEvent.type(input, "00");
    expect(input).toHaveValue("2.50");
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
