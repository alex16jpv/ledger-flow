import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/lib/testing/render";

import { PickerSheet } from "./PickerSheet";

const options = [
  { value: "COP", label: "COP · Colombian Peso" },
  { value: "USD", label: "USD · US Dollar" },
  { value: "EUR", label: "EUR · Euro", keywords: "europe" },
];

describe("PickerSheet", () => {
  it("filters accent-insensitively, marks the selected option and reports the choice", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <PickerSheet
        open
        onClose={onClose}
        title="Choose your currency"
        options={options}
        value="COP"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("option", { name: /COP/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "éuro");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.click(screen.getByRole("option", { name: /EUR/ }));
    expect(onSelect).toHaveBeenCalledWith("EUR");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an empty state when nothing matches", async () => {
    renderWithProviders(
      <PickerSheet
        open
        onClose={vi.fn()}
        title="Choose"
        options={options}
        value={null}
        onSelect={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByRole("heading", { name: "No results" })).toBeInTheDocument();
  });
});
