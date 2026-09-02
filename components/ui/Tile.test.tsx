import { render } from "@testing-library/react";

import { Dot, Tile } from "./Tile";

describe("Tile", () => {
  it("sets the feature color variables from the token", () => {
    const { container } = render(
      <Tile color="RED" size="lg">
        <svg />
      </Tile>,
    );
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue("--f-soft")).toBe("var(--c-red-soft)");
    expect(tile.className).toContain("size-14");
  });

  it("falls back to the neutral color without a token", () => {
    const { container } = render(
      <Tile variant="outline">
        <svg />
      </Tile>,
    );
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.getPropertyValue("--f")).toBe("");
    expect(tile.className).toContain("border-dashed");
  });

  it("renders a decorative dot", () => {
    const { container } = render(<Dot color="BLUE" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
