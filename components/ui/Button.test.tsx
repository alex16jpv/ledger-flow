import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, buttonClasses } from "./Button";

describe("Button", () => {
  it("renders variants and sizes through token classes", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-brand");
    expect(buttonClasses({ variant: "danger" })).toContain("bg-danger-soft");
    expect(buttonClasses({ size: "lg" })).toContain("h-(--control-lg)");
    const icon = buttonClasses({ iconOnly: true, round: true });
    expect(icon).toContain("rounded-full");
    expect(icon).not.toMatch(/px-\d|rounded-md/);
  });

  it("paints the secondary border and only that variant's (T-05)", () => {
    const secondary = buttonClasses({ variant: "secondary" });
    expect(secondary).toContain("border-border-strong");
    expect(secondary).not.toContain("border-transparent");
    expect(buttonClasses({ variant: "primary" })).toContain("border-transparent");
    expect(buttonClasses({ variant: "ghost" })).toContain("border-transparent");
  });

  it("blocks double submit while loading and exposes aria-busy", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
