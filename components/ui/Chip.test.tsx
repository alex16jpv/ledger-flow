import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CategoryChip, Chip } from "./Chip";

describe("Chip", () => {
  it("exposes selection through aria-pressed and toggles on click", async () => {
    const onClick = vi.fn();
    render(
      <Chip selected onClick={onClick}>
        Food
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Food", pressed: true });
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("tints the category chip with its color when selected", () => {
    render(
      <CategoryChip selected color="ORANGE" icon={<svg />}>
        Food
      </CategoryChip>,
    );
    const chip = screen.getByRole("button", { pressed: true });
    expect(chip.style.getPropertyValue("--f")).toBe("var(--c-orange)");
    expect(chip.className).toContain("bg-(--f-soft)");
  });
});
