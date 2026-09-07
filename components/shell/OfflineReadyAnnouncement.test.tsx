import { screen, waitFor } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { setCurrentVault } from "@/lib/local/repository";
import { SHELL_SCREENS, shellCacheKey, shellUrls } from "@/lib/pwa/shell";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { OfflineReadyAnnouncement } from "./OfflineReadyAnnouncement";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/home",
}));

const shellCache = new Set<string>();
const fakeCaches = {
  open: () => Promise.resolve({ match: (key: string) => Promise.resolve(shellCache.has(key)) }),
};

const warmScreens = (count: number): void => {
  for (const url of shellUrls("en", window.location.origin).slice(0, count)) {
    shellCache.add(shellCacheKey(url));
  }
};

async function deviceWith({ screens, synced }: { screens: number; synced: boolean }) {
  warmScreens(screens);
  const vault = await openTestVault("u1");
  if (synced) await vault.db.put("meta", { key: "syncedAt", value: "2026-09-06T10:00:00.000Z" });
  setCurrentVault(vault);
}

beforeEach(() => {
  shellCache.clear();
  window.localStorage.clear();
  vi.stubGlobal("caches", fakeCaches);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  setCurrentVault(null);
  await wipeVaults();
});

const render = (enabled = true) =>
  renderWithProviders(
    <ToastProvider>
      <OfflineReadyAnnouncement enabled={enabled} />
    </ToastProvider>,
  );

describe("the one-off “ready to use offline”", () => {
  it("says it when both the data and the screens are on the device", async () => {
    await deviceWith({ screens: SHELL_SCREENS, synced: true });

    render();

    expect(await screen.findByText("Ready to use offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What this means" })).toBeInTheDocument();
  });

  it("says nothing while the screens are still coming", async () => {
    await deviceWith({ screens: 18, synced: true });

    render();

    await waitFor(() => {
      expect(shellCache.size).toBe(18);
    });
    expect(screen.queryByText("Ready to use offline")).not.toBeInTheDocument();
  });

  it("says nothing before the data has landed", async () => {
    await deviceWith({ screens: SHELL_SCREENS, synced: false });

    render();

    await waitFor(() => {
      expect(shellCache.size).toBe(SHELL_SCREENS);
    });
    expect(screen.queryByText("Ready to use offline")).not.toBeInTheDocument();
  });

  // Once per device, not once per session: after the first time it is noise, and Sync status is
  // where it can be looked up.
  it("never says it twice on the same device", async () => {
    await deviceWith({ screens: SHELL_SCREENS, synced: true });
    const first = render();
    expect(await screen.findByText("Ready to use offline")).toBeInTheDocument();
    first.unmount();

    render();

    await waitFor(() => {
      expect(window.localStorage.getItem("ledger-flow.offline-ready-announced")).toBe("1");
    });
    expect(screen.queryByText("Ready to use offline")).not.toBeInTheDocument();
  });
});
