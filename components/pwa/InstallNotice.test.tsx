import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/lib/testing/render";

import { InstallNotice } from "./InstallNotice";

const copy = {
  title: "Keep your data on this phone",
  install: "Install",
  how: "How",
  dismiss: "Not now",
  sheet: "Install this app",
};

const prompt = vi.hoisted(() => ({ state: "unavailable", install: vi.fn() }));
const mode = vi.hoisted(() => ({ value: "browser" }));

vi.mock("@/lib/pwa/install", () => ({
  useInstallPrompt: () => ({ state: prompt.state, install: prompt.install }),
}));
vi.mock("@/lib/pwa/mode", () => ({ displayMode: () => mode.value }));

const view = (hasSomethingToLose = true) =>
  renderWithProviders(<InstallNotice hasSomethingToLose={hasSomethingToLose} />);

describe("InstallNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
    prompt.state = "unavailable";
    prompt.install.mockReset();
    prompt.install.mockResolvedValue(undefined);
    mode.value = "browser";
  });

  // P-34: the browser cannot always ask, so the app does — but only once there is something to lose.
  it("stays quiet on a device with nothing stored yet", () => {
    view(false);

    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
  });

  it("offers the browser's own prompt when there is one", async () => {
    prompt.state = "available";
    view();

    await userEvent.click(screen.getByRole("button", { name: copy.install }));

    expect(prompt.install).toHaveBeenCalledOnce();
  });

  // iOS, where no such event exists: the way in is the sheet with the steps.
  it("opens the steps where the browser never offers", async () => {
    view();

    await userEvent.click(screen.getByRole("button", { name: copy.how }));

    expect(await screen.findByText(copy.sheet)).toBeInTheDocument();
  });

  it("says nothing in the installed app", () => {
    mode.value = "installed";
    view();

    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
  });

  it("goes away for a week when dismissed, and the next mount respects it", async () => {
    const { unmount } = view();

    await userEvent.click(screen.getByRole("button", { name: copy.dismiss }));
    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();

    unmount();
    view();
    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
  });
});
