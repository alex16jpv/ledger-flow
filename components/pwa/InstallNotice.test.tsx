import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Platform from "@/lib/pwa/platform";
import { renderWithProviders } from "@/lib/testing/render";

import { InstallNotice } from "./InstallNotice";

const copy = {
  title: "For when there’s no connection",
  risk: "This browser can also delete what you record offline after a few days without opening the site. Installing the app stops that.",
  install: "Install",
  how: "How",
  dismiss: "Not now",
  sheet: "Install this app",
  chrome: "Install with Chrome",
  here: "Install it here",
  samsungStep: "Tap the install icon in the address bar",
};

const prompt = vi.hoisted(() => ({ state: "unavailable", install: vi.fn() }));
const mode = vi.hoisted(() => ({ value: "browser" }));
const device = vi.hoisted(() => ({ value: "ios", guide: "ios-safari" }));
const durability = vi.hoisted(() => ({ supported: true, persisted: false }));

vi.mock("@/lib/pwa/install", () => ({
  useInstallPrompt: () => ({ state: prompt.state, install: prompt.install }),
}));
vi.mock("@/lib/pwa/mode", () => ({ displayMode: () => mode.value }));
vi.mock("@/lib/pwa/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  devicePlatform: () => device.value,
  installGuide: () => device.guide,
}));
vi.mock("@/lib/local/persist", () => ({
  readStorageDurability: () =>
    Promise.resolve({ ...durability, usageBytes: null, quotaBytes: null }),
}));

const view = (hasSomethingToLose = true) =>
  renderWithProviders(<InstallNotice hasSomethingToLose={hasSomethingToLose} />);

const card = () => screen.findByText(copy.title);

// The card decides only once the durability read resolves, so a "not there" claim has to wait for it.
const noCard = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
};

async function dismiss(times: number) {
  for (let i = 0; i < times; i++) {
    const { unmount } = view();
    await userEvent.click(await screen.findByRole("button", { name: copy.dismiss }));
    unmount();
    vi.setSystemTime(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
}

describe("InstallNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
    prompt.state = "unavailable";
    prompt.install.mockReset();
    prompt.install.mockResolvedValue(undefined);
    mode.value = "browser";
    device.value = "ios";
    device.guide = "ios-safari";
    durability.supported = true;
    durability.persisted = false;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));
  });

  // P-34: the browser cannot always ask, so the app does — but only once there is something to lose.
  it("stays quiet on a device with nothing stored yet", async () => {
    view(false);

    await noCard();
  });

  it("says nothing in the installed app", async () => {
    mode.value = "installed";
    view();

    await noCard();
  });

  // P-46: the browser puts its own install button in the address bar and Settings carries the row.
  it("never appears on a desktop", async () => {
    device.value = "desktop";
    view();

    await noCard();
  });

  it("offers the browser's own prompt when there is one", async () => {
    prompt.state = "available";
    device.value = "android";
    view();

    await userEvent.click(await screen.findByRole("button", { name: copy.install }));

    expect(prompt.install).toHaveBeenCalledOnce();
  });

  it("opens the steps where the browser never offers", async () => {
    view();

    await userEvent.click(await screen.findByRole("button", { name: copy.how }));

    expect(await screen.findByText(copy.sheet)).toBeInTheDocument();
  });

  // P-46: the deletion sentence is true on every iPhone and on an Android that was told no.
  it("warns about deletion only where the browser has not protected the copy", async () => {
    view();

    expect(await screen.findByText(copy.risk)).toBeInTheDocument();
  });

  it("drops the deletion sentence once the browser granted durable storage", async () => {
    device.value = "android";
    durability.persisted = true;
    view();

    expect(await card()).toBeInTheDocument();
    expect(screen.queryByText(copy.risk)).not.toBeInTheDocument();
  });

  it("hides for three days on iOS and comes back after them", async () => {
    const { unmount } = view();
    await userEvent.click(await screen.findByRole("button", { name: copy.dismiss }));
    unmount();

    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const still = view();
    await noCard();
    still.unmount();

    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    view();
    expect(await card()).toBeInTheDocument();
  });

  // The whole point of the platform split: Safari deletes the copy and offers no prompt of its own.
  it("never gives up on iOS, however many times it is dismissed", async () => {
    await dismiss(6);
    view();

    expect(await card()).toBeInTheDocument();
  });

  it("gives up on Android after the third dismissal", async () => {
    device.value = "android";
    await dismiss(3);
    view();

    await noCard();
  });

  // T-197: installed from Samsung Internet, Android blocks the app as dangerous; from Chrome it does not.
  describe("in Samsung Internet", () => {
    beforeEach(() => {
      device.value = "android";
      device.guide = "samsung";
    });

    it("sends the user to Chrome instead of Samsung's own install", async () => {
      prompt.state = "available";
      view();

      const chrome = await screen.findByRole("link", { name: copy.chrome });

      expect(chrome.getAttribute("href")).toMatch(/^intent:\/\/.+;package=com\.android\.chrome;/);
      expect(screen.queryByRole("button", { name: copy.install })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: copy.how })).not.toBeInTheDocument();
    });

    it("keeps Samsung's prompt one tap away for whoever has no Chrome", async () => {
      prompt.state = "available";
      view();

      await userEvent.click(await screen.findByRole("button", { name: copy.here }));

      expect(prompt.install).toHaveBeenCalledOnce();
    });

    it("gives Samsung's own steps where it offered no prompt", async () => {
      view();

      await userEvent.click(await screen.findByRole("button", { name: copy.here }));

      expect(prompt.install).not.toHaveBeenCalled();
      expect(await screen.findByText(copy.samsungStep)).toBeInTheDocument();
    });
  });
});
