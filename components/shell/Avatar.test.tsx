import { Avatar as Drawing, Style } from "@dicebear/core";
import blobs from "@dicebear/styles/blobs.json";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, blobOf } from "./Avatar";

const ID = "6f1c2a4e-8b3d-4c5e-9a7f-0b1c2d3e4f50";
const OTHER = "0d9e8f7a-6b5c-4d3e-8f2a-1b0c9d8e7f6a";

describe("blobOf", () => {
  // The server and the browser each draw it, so a fresh drawing must match the cached one.
  it("draws the same blob for the same id and a different one for another", () => {
    expect(blobOf(ID)).toMatch(/^data:image\/svg\+xml/);
    expect(blobOf(ID)).toBe(new Drawing(new Style(blobs), { seed: ID }).toDataUri());
    expect(blobOf(OTHER)).not.toBe(blobOf(ID));
  });
});

describe("Avatar", () => {
  it("draws the blob of its seed as a decoration", () => {
    const { container } = render(<Avatar seed={ID} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", blobOf(ID));
    expect(img).toHaveAttribute("alt", "");
    expect(container.textContent).toBe("");
  });

  // F-82: offline the profile can be missing, and an empty circle reads as a broken avatar.
  it.each([undefined, null, ""])("falls back to the person icon with seed %o", (seed) => {
    const { container } = render(<Avatar seed={seed} />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
