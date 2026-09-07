import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  // F-41: `onClose` used to be `onSignIn`, so the X, Escape and the scrim all led to the login and
  // the sheet was a wall with another door.
  it("closes for good in local mode instead of walking to the login", async () => {
    const onSignIn = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <SessionExpiredSheet open localMode onSignIn={onSignIn} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("stays a wall with no vault: closing it still goes to the login", async () => {
    const onSignIn = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<SessionExpiredSheet open onSignIn={onSignIn} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not ask for a sign-in there is no network to do (§2.6)", () => {
    reportOnline(false);
    renderWithProviders(<SessionExpiredSheet open localMode onSignIn={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Sign in to sync" })).not.toBeInTheDocument();
  });
});
