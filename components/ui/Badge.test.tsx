import { render, screen } from "@testing-library/react";

import { Badge } from "./Badge";
import { Tag } from "./Tag";

describe("Badge and Tag", () => {
  it("maps tones to state tokens", () => {
    render(<Badge tone="warning">To review</Badge>);
    expect(screen.getByText("To review").className).toContain("bg-warning-soft");
  });

  it("renders tags with a decorative hash", () => {
    render(<Tag label="coffee" />);
    const tag = screen.getByText("coffee");
    expect(tag.textContent).toBe("#coffee");
    expect(tag.querySelector("[aria-hidden]")).not.toBeNull();
  });
});
