import { screen } from "@testing-library/react";

import { reportOnline } from "@/lib/network/connectivity";
import { renderWithProviders } from "@/lib/testing/render";

import { SessionExpiredSheet } from "./SessionExpiredSheet";

afterEach(() => {
  reportOnline(true);
});

describe("the expired session sheet", () => {
  it("is a wall when the device has no vault to fall back to", () => {
    renderWithProviders(<SessionExpiredSheet open onSignIn={vi.fn()} />);
    expect(screen.getByText("Your session ended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("offers to sync instead of blocking when the app still works locally", () => {
    renderWithProviders(<SessionExpiredSheet open localMode onSignIn={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.getByText(/keeps working on this device/i)).toBeInTheDocument();
  });

  it("does not ask for a sign-in there is no network to do (§2.6)", () => {
    reportOnline(false);
    renderWithProviders(<SessionExpiredSheet open localMode onSignIn={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Sign in to sync" })).not.toBeInTheDocument();
  });
});
