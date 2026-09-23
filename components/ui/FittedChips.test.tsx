import { act, render, screen } from "@testing-library/react";

import { fitChips, FittedChips } from "./FittedChips";

const fit = (
  widths: number[],
  { pinned = [] as number[], trailing = 80, row = 360, gap = 8, lines = 2 } = {},
) => fitChips({ widths, pinned, trailing, row, gap, lines });

describe("fitChips", () => {
  it("keeps every chip that fits in the lines with the trailing one", () => {
    expect(fit([77, 89, 104, 99])).toEqual([0, 1, 2, 3]);
  });

  it("keeps only what fits on one line when one line is allowed", () => {
    expect(fit([77, 89, 104, 99], { lines: 1 })).toEqual([0, 1]);
  });

  it("drops a chip longer than a line and lets a shorter one down the ranking take its place", () => {
    expect(fit([150, 400, 89, 104])).toEqual([0, 2, 3]);
  });

  it("drops a chip that would push the trailing one past the last line", () => {
    expect(fit([200, 200, 150, 60])).toEqual([0, 1, 3]);
  });

  it("always keeps the pinned chip, even when it is longer than a line", () => {
    expect(fit([77, 89, 104, 500], { pinned: [3] })).toEqual([3]);
  });

  it("reserves room for the pinned chip before the ones ranked above it", () => {
    expect(fit([150, 150, 150, 150], { pinned: [3] })).toEqual([0, 1, 3]);
  });

  it("keeps two pinned chips before the rest", () => {
    expect(fit([150, 150, 150, 150], { pinned: [2, 3] })).toEqual([0, 2, 3]);
  });

  it("keeps nothing when there is nothing to fit", () => {
    expect(fit([])).toEqual([]);
  });
});

describe("FittedChips", () => {
  const WIDTHS: Record<string, number> = { Food: 77, Coffee: 89, Groceries: 400, Transport: 104 };
  let rowWidth = 300;
  let resized: (() => void)[] = [];

  beforeEach(() => {
    rowWidth = 300;
    resized = [];
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measure(
      this: Element,
    ) {
      const width =
        this.getAttribute("role") === "group" ? rowWidth : (WIDTHS[this.textContent] ?? 80);
      return DOMRect.fromRect({ width, height: 32 });
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderChips(
    pinned: string | null = null,
    items = ["Food", "Groceries", "Coffee", "Transport"],
  ) {
    render(
      <FittedChips
        role="group"
        aria-label="Category"
        items={items}
        keyOf={(name) => name}
        pinned={pinned}
        lines={2}
        renderItem={(name) => <button type="button">{name}</button>}
        trailing={<button type="button">More</button>}
      />,
    );
    const group = screen.getByRole("group", { name: "Category" });
    return () => [...group.querySelectorAll("button")].map((button) => button.textContent);
  }

  function resize(width: number) {
    rowWidth = width;
    act(() => {
      for (const callback of resized) callback();
    });
  }

  it("draws the chips that fit and the trailing chip last, with nothing hidden reachable", () => {
    const names = renderChips();
    expect(names()).toEqual(["Food", "Coffee", "Transport", "More"]);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(names());
  });

  it("draws the pinned chip cut to a line and fills the other line with what fits", () => {
    expect(renderChips("Groceries")()).toEqual(["Groceries", "Coffee", "Transport", "More"]);
  });

  it("ignores a pinned key that is not among the items", () => {
    expect(renderChips("Rent")()).toEqual(["Food", "Coffee", "Transport", "More"]);
  });

  it("draws only the trailing chip when there are no items", () => {
    expect(renderChips(null, [])()).toEqual(["More"]);
  });

  it("fits again when the row is resized, and keeps the last fit while it is hidden", () => {
    const names = renderChips();
    resize(180);
    expect(names()).toEqual(["Food", "Coffee", "More"]);
    resize(0);
    expect(names()).toEqual(["Food", "Coffee", "More"]);
    resize(300);
    expect(names()).toEqual(["Food", "Coffee", "Transport", "More"]);
  });

  it("keeps the focused chip when a resize would drop it", () => {
    const names = renderChips();
    screen.getByRole("button", { name: "Transport" }).focus();
    resize(180);
    expect(names()).toEqual(["Transport", "More"]);
    expect(screen.getByRole("button", { name: "Transport" })).toHaveFocus();
  });
});
