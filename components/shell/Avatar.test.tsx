import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, initialsOf } from "./Avatar";

describe("initialsOf", () => {
  it("takes the first and last initial, and only the first when there is one word", () => {
    expect(initialsOf("Alex Perez")).toBe("AP");
    expect(initialsOf("Alex")).toBe("A");
    expect(initialsOf("  alex  de la  torre ")).toBe("AT");
  });

  it("answers nothing for a name it does not have", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});

describe("Avatar", () => {
  it("draws the initials it was given", () => {
    render(<Avatar name="Alex Perez" />);

    expect(screen.getByText("AP")).toBeInTheDocument();
  });

  // F-82: offline the name can be missing, and two empty initials read as a broken avatar.
  it("falls back to the person icon with no name", () => {
    const { container } = render(<Avatar name="" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
