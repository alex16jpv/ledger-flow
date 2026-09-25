import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Platform from "@/lib/pwa/platform";
import { renderWithProviders } from "@/lib/testing/render";

import { InstallSheet } from "./InstallSheet";

const copy = {
  asked:
    "The app already asked this browser to keep your data and it said no — browsers don’t ask you, they decide, and installing is what changes that.",
  install: "Install",
  chrome: "Install with Chrome",
  here: "Install it here",
  iosShare: "Tap Share",
  iosOtherShare: "Tap Share, in the address bar or in the browser menu",
  androidMenu: "Open the browser menu",
  macDock: "Choose “Add to Dock”",
  desktopIcon: "Look for the install icon in the address bar",
  samsungStep: "Tap the install icon in the address bar",
  fallback:
    "Some browsers don’t offer this at all. If yours doesn’t, keep a connection when you record and nothing will be waiting here.",
  safari: "If your browser doesn’t offer it, open this page in Safari and add it from there.",
};

const prompt = vi.hoisted(() => ({ state: "unavailable", install: vi.fn() }));
const device = vi.hoisted(() => ({ guide: "ios-safari" }));
const durability = vi.hoisted(() => ({ supported: true, persisted: false }));

vi.mock("@/lib/pwa/install", () => ({
  useInstallPrompt: () => ({ state: prompt.state, install: prompt.install }),
}));
vi.mock("@/lib/pwa/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  installGuide: () => device.guide,
}));
vi.mock("@/lib/local/persist", () => ({
  readStorageDurability: () =>
    Promise.resolve({ ...durability, usageBytes: null, quotaBytes: null }),
}));

const onClose = vi.fn();
const view = () => renderWithProviders(<InstallSheet open onClose={onClose} />);

const settled = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe("InstallSheet", () => {
  beforeEach(() => {
    prompt.state = "unavailable";
    prompt.install.mockReset();
    prompt.install.mockResolvedValue(undefined);
    device.guide = "ios-safari";
    durability.supported = true;
    durability.persisted = false;
    onClose.mockReset();
  });

  it("fires the browser's own prompt where it offered one, and closes", async () => {
    prompt.state = "available";
    device.guide = "android";
    view();

    await userEvent.click(screen.getByRole("button", { name: copy.install }));

    expect(prompt.install).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["ios-safari", copy.iosShare, copy.fallback],
    ["ios-other", copy.iosOtherShare, copy.safari],
    ["android", copy.androidMenu, copy.fallback],
    ["mac-safari", copy.macDock, copy.fallback],
    ["desktop", copy.desktopIcon, copy.fallback],
  ])("gives %s only its own steps", (guide, step, closing) => {
    device.guide = guide;
    view();

    expect(screen.getByText(step)).toBeInTheDocument();
    expect(screen.getByText(closing)).toBeInTheDocument();
    for (const other of [copy.iosShare, copy.iosOtherShare, copy.androidMenu, copy.macDock]) {
      if (other !== step) expect(screen.queryByText(other)).not.toBeInTheDocument();
    }
  });

  it("says the browser refused only where it did", async () => {
    view();

    expect(await screen.findByText(copy.asked)).toBeInTheDocument();
  });

  it.each([
    ["granted durable storage", { supported: true, persisted: true }],
    ["cannot be asked at all", { supported: false, persisted: false }],
  ])("does not claim a refusal from a browser that %s", async (_, storage) => {
    Object.assign(durability, storage);
    view();
    await settled();

    expect(screen.queryByText(copy.asked)).not.toBeInTheDocument();
  });

  // T-197: Samsung's own install ends in Android's dangerous-app block, so Chrome leads.
  describe("in Samsung Internet", () => {
    beforeEach(() => {
      device.guide = "samsung";
    });

    it("leads with Chrome and keeps Samsung's prompt as the fallback", async () => {
      prompt.state = "available";
      view();

      expect(screen.getByRole("link", { name: copy.chrome }).getAttribute("href")).toMatch(
        /^intent:\/\/.+;package=com\.android\.chrome;/,
      );
      expect(screen.queryByRole("button", { name: copy.install })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: copy.here }));

      expect(prompt.install).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("gives Samsung's steps instead of a link that could do nothing", () => {
      view();

      expect(screen.getByText(copy.samsungStep)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: copy.here })).not.toBeInTheDocument();
    });
  });
});
