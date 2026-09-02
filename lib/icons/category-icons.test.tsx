import { render } from "@testing-library/react";

import {
  CATEGORY_ICON_KEYS,
  CATEGORY_ICONS,
  categoryIcon,
  isCategoryIconKey,
} from "./category-icons";
import { CategoryIcon } from "./CategoryIcon";

const DESIGN_SET =
  "house utensils car zap shopping-bag briefcase coins circle-plus repeat credit-card coffee stethoscope dog cat pizza shopping-cart bus fuel plane train-front bike pill dumbbell graduation-cap book-open gamepad-2 music film tv wifi phone droplets flame lightbulb shirt scissors baby wrench hammer paint-bucket sofa bed key shield umbrella hand-coins percent gift heart star trophy sprout leaf beer wine cake ice-cream-cone apple carrot croissant sandwich ticket popcorn headphones camera laptop bath washing-machine trees mountain tent ship glasses watch gem crown medal paintbrush footprints cookie martini church store shopping-basket package truck plug battery radio speaker piggy-bank landmark banknote wallet receipt calculator scale target layers building-2 trending-up trending-down arrow-left-right tag hash".split(
    " ",
  );

describe("CATEGORY_ICONS", () => {
  it("contains exactly the 105 keys of DESIGN.md §4.3", () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(105);
    expect([...CATEGORY_ICON_KEYS].sort()).toEqual([...DESIGN_SET].sort());
  });

  it("resolves every key to a renderable icon", () => {
    for (const key of CATEGORY_ICON_KEYS) {
      const Icon = CATEGORY_ICONS[key];
      const { container, unmount } = render(<Icon />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("falls back to hash for unknown or missing keys", () => {
    expect(categoryIcon(null)).toBe(CATEGORY_ICONS.hash);
    expect(categoryIcon("emoji-rocket")).toBe(CATEGORY_ICONS.hash);
    expect(isCategoryIconKey("coffee")).toBe(true);
    expect(isCategoryIconKey("constructor")).toBe(false);
  });
});

describe("CategoryIcon", () => {
  it("renders a decorative svg with the requested size and stroke", () => {
    const { container } = render(<CategoryIcon icon="coffee" size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
