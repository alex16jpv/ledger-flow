import { render, screen } from "@testing-library/react";

import { Empty } from "./Empty";

describe("Empty", () => {
  it("titles a section with an h2", () => {
    render(<Empty icon={<svg />} title="No transactions yet" />);
    expect(screen.getByRole("heading", { level: 2, name: "No transactions yet" })).toBeVisible();
  });

  it("carries the page's heading where it is the whole page", () => {
    render(<Empty icon={<svg />} title="Page not found" titleAs="h1" titleSize="page" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Page not found" });
    expect(heading.className).toContain("text-2xl");
  });
});
