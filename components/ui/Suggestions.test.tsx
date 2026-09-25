import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { renderWithProviders } from "@/lib/testing/render";

import { type SuggestionRow, Suggestions } from "./Suggestions";

const ALL = ["Uber to work", "Uber home", "Latte"];

function Harness({ onPick }: { onPick: (row: SuggestionRow) => void }) {
  const [value, setValue] = useState("");
  const rows = value.trim()
    ? ALL.filter((text) => text.toLowerCase().startsWith(value.toLowerCase())).map((text) => ({
        key: text,
        value: text,
        name: `Use ${text}`,
        label: text,
      }))
    : [];
  return (
    <Suggestions
      rows={rows}
      query={value}
      label="Suggestions"
      onPick={(row) => {
        setValue(row.value);
        onPick(row);
      }}
    >
      {(combobox) => (
        <input
          aria-label="Description"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          {...combobox}
        />
      )}
    </Suggestions>
  );
}

describe("Suggestions", () => {
  it("opens once there is something typed, with nothing highlighted until ArrowDown", async () => {
    const onPick = vi.fn();
    renderWithProviders(<Harness onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "Description" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(input, "ub");
    const list = screen.getByRole("listbox", { name: "Suggestions" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Uber to work",
      "Uber home",
    ]);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByText("2 suggestions")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const home = screen.getByRole("option", { name: "Use Uber home" });
    expect(home).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", home.id);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: "Uber to work" }));
    expect(input).toHaveValue("Uber to work");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("announces the count once per opening, not on every keystroke", async () => {
    renderWithProviders(<Harness onPick={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Description" });
    await userEvent.type(input, "u");
    expect(screen.getByText("2 suggestions")).toBeInTheDocument();
    await userEvent.type(input, "ber h");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("2 suggestions")).toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.queryByText(/suggestions/)).not.toBeInTheDocument();
    await userEvent.type(input, "l");
    expect(screen.getByText("1 suggestion")).toBeInTheDocument();
  });

  it("closes on Escape without letting it reach a sheet, and comes back when the text changes", async () => {
    const onPick = vi.fn();
    const escaped = vi.fn();
    renderWithProviders(
      <div
        onKeyDown={(event) => {
          if (event.key === "Escape") escaped();
        }}
      >
        <Harness onPick={onPick} />
      </div>,
    );
    const input = screen.getByRole("combobox", { name: "Description" });
    await userEvent.type(input, "ub");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(escaped).not.toHaveBeenCalled();
    expect(input).toHaveValue("ub");
    await userEvent.keyboard("{Escape}");
    expect(escaped).toHaveBeenCalledTimes(1);
    await userEvent.type(input, "e");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{Escape}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Use Uber to work" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("closes on blur and takes a tap on a row without losing the field", async () => {
    const onPick = vi.fn();
    renderWithProviders(<Harness onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "Description" });
    await userEvent.type(input, "la");
    fireEvent.blur(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.focus(input);
    const option = screen.getByRole("option", { name: "Use Latte" });
    expect(fireEvent.mouseDown(option)).toBe(false);
    await userEvent.click(option);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: "Latte" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
