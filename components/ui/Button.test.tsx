import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, buttonClasses } from "./Button";

describe("Button", () => {
  it("renders variants and sizes through token classes", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-brand");
    expect(buttonClasses({ variant: "danger" })).toContain("bg-danger-soft");
    expect(buttonClasses({ size: "lg" })).toContain("h-(--control-lg)");
    expect(buttonClasses({ iconOnly: true, round: true })).toContain("rounded-full");
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
