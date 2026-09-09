import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/lib/testing/render";

import { NoSessionChoiceSheet } from "./NoSessionChoiceSheet";

const copy = {
  title: "This device has your data, but no session",
  signIn: "Sign in to sync",
  stay: "Continue on this device only",
  wipe: "Delete everything on this device",
  confirmTitle: "Delete everything on this device?",
  confirmCta: "Delete everything",
  cancel: "Cancel",
};

const view = (overrides: Partial<Parameters<typeof NoSessionChoiceSheet>[0]> = {}) => {
  const props = {
    open: true,
    pending: 2,
    onSignIn: vi.fn(),
    onStayLocal: vi.fn(),
    onWipe: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<NoSessionChoiceSheet {...props} />);
  return props;
};

describe("NoSessionChoiceSheet", () => {
  it("offers the three exits, with the queue counted", () => {
    view();

    expect(screen.getByRole("dialog", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.signIn })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.stay })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.wipe })).toBeInTheDocument();
    expect(screen.getByText(/2 changes are saved on this device/)).toBeInTheDocument();
  });

  it("sends the first exit to the login", async () => {
    const props = view();

    await userEvent.click(screen.getByRole("button", { name: copy.signIn }));

    expect(props.onSignIn).toHaveBeenCalledOnce();
  });

  it("takes the second exit as the choice it is", async () => {
    const props = view();

    await userEvent.click(screen.getByRole("button", { name: copy.stay }));

    expect(props.onStayLocal).toHaveBeenCalledOnce();
  });

  // P-32: the third exit throws away work nobody else has, so it is the one that asks.
  it("asks before deleting, and names what is lost", async () => {
    const props = view();

    await userEvent.click(screen.getByRole("button", { name: copy.wipe }));

    expect(await screen.findByRole("dialog", { name: copy.confirmTitle })).toBeInTheDocument();
    expect(screen.getByText(/2 changes that only exist here/)).toBeInTheDocument();
    expect(props.onWipe).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: copy.confirmCta }));
    expect(props.onWipe).toHaveBeenCalledOnce();
  });

  it("comes back from the confirmation without deleting anything", async () => {
    const props = view();

    await userEvent.click(screen.getByRole("button", { name: copy.wipe }));
    await userEvent.click(screen.getByRole("button", { name: copy.cancel }));

    expect(await screen.findByRole("button", { name: copy.stay })).toBeInTheDocument();
    expect(props.onWipe).not.toHaveBeenCalled();
  });

  // The one sheet that cannot be closed without answering: closing it would put the user back in
  // the state this exists to remove.
  it("does not close on Escape", async () => {
    const props = view();

    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: copy.title })).toBeInTheDocument();
    expect(props.onSignIn).not.toHaveBeenCalled();
  });

  it("drops the count from the copy when the queue is empty", () => {
    view({ pending: 0 });

    expect(screen.getByText(/everything you record stays on this device/)).toBeInTheDocument();
  });
});
