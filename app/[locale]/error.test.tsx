import { screen } from "@testing-library/react";
import { vi } from "vitest";

import { renderWithProviders } from "@/lib/testing/render";

import PublicError from "./error";

vi.mock("@/lib/observability/reporter", () => ({
  reportError: vi.fn(),
  requestIdOf: () => undefined,
}));

describe("PublicError", () => {
  it("titles the page it replaces", () => {
    renderWithProviders(<PublicError error={new Error("boom")} reset={() => undefined} />);

    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
  });
});
