import { screen } from "@testing-library/react";
import { vi } from "vitest";

import { renderWithProviders } from "@/lib/testing/render";

import AppError from "./error";

vi.mock("@/lib/observability/reporter", () => ({
  reportError: vi.fn(),
  requestIdOf: () => undefined,
}));

describe("AppError", () => {
  it("titles the screen it replaces, header and all", () => {
    renderWithProviders(<AppError error={new Error("boom")} reset={() => undefined} />);

    expect(screen.getByRole("heading", { level: 1, name: "We couldn’t load this" })).toBeVisible();
  });
});
