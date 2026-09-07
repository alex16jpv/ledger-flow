import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CATEGORY_ICON_KEYS } from "@/lib/icons/category-icons";
import { renderWithProviders } from "@/lib/testing/render";

import { IconGrid } from "./IconGrid";

describe("IconGrid", () => {
  it("lists every curated icon, filters by key and reports the pressed one", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <IconGrid
        value="utensils"
        onChange={onChange}
        label="Icon"
        searchLabel="Search icons"
        color="ORANGE"
      />,
    );
    const group = screen.getByRole("group", { name: "Icon" });
    expect(group.querySelectorAll("button")).toHaveLength(CATEGORY_ICON_KEYS.length);
    expect(screen.getByRole("button", { name: "utensils" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.type(screen.getByRole("searchbox", { name: "Search icons" }), "shopping");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "shopping-cart" }));
    expect(onChange).toHaveBeenCalledWith("shopping-cart");
  });

  it("says when no icon matches", async () => {
    renderWithProviders(
      <IconGrid value={null} onChange={vi.fn()} label="Icon" searchLabel="Search icons" />,
    );
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});
