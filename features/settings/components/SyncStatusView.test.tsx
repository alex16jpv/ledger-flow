import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { refreshOutboxStatus, resetOutboxStatus, setBlockedOperations } from "@/lib/local/outbox";
import { setCurrentVault } from "@/lib/local/repository";
import { accountRecord, type OutboxOperation } from "@/lib/local/schema";
import { reportOnline } from "@/lib/network/connectivity";
import { SHELL_SCREENS, shellCacheKey, shellUrls } from "@/lib/pwa/shell";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { tabChannel } from "@/lib/session/channel";
import { SessionProvider } from "@/lib/session/SessionProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { account, openTestVault, wipeVaults } from "@/lib/testing/vault";

import { SyncStatusView } from "./SyncStatusView";

const operation = (seq: number): OutboxOperation => ({
  seq,
  opId: `op-${seq}`,
  opVersion: 1,
  entity: "transaction",
  entityId: `t${seq}`,
  action: "create",
  occurredAt: "2026-08-01T10:00:00.000Z",
  payload: {},
  dependsOn: [],
  status: "pending",
  attempts: 0,
  lastError: "NETWORK",
});

const fetchMock = vi.fn<typeof fetch>();
const shellCache = new Set<string>();

const fakeCaches = {
  open: () => Promise.resolve({ match: (key: string) => Promise.resolve(shellCache.has(key)) }),
};

// What the worker leaves behind after warming the screens of §6 O-F6.
const warmScreens = (count: number): void => {
  for (const url of shellUrls("en", window.location.origin).slice(0, count)) {
    shellCache.add(shellCacheKey(url));
  }
};

beforeEach(() => {
  shellCache.clear();
  vi.stubGlobal("caches", fakeCaches);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ user: { id: "u1", name: "John", locale: "en" } }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  setCurrentVault(null);
  resetOutboxStatus();
  vi.unstubAllGlobals();
  await wipeVaults();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <SessionProvider onSignedOut={vi.fn()}>
        <ToastProvider>
          <SyncStatusView />
        </ToastProvider>
      </SessionProvider>
    </QueryProvider>,
  );

describe("Sync status", () => {
  it("shows what the device has and what it still owes", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account({ id: "a1" })));
    await vault.db.put("meta", { key: "syncCursor", value: "cur-1" });
    await vault.db.put("outbox", operation(1));
    await vault.db.put("outbox", operation(2));
    setCurrentVault(vault);
    await refreshOutboxStatus(vault.db);

    view();

    expect(await screen.findByText("Set")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Last error: NETWORK")).toBeInTheDocument();
    // §4.3 rule 3: the app says which mode it runs in, because on iOS they hold different data.
    expect(screen.getByText("Browser tab")).toBeInTheDocument();
  });

  // F-65: `openVault` said the queue was blocked and no screen said it.
  it("says the queue is blocked by an app update, and where to see it", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("outbox", operation(1));
    setCurrentVault(vault);
    setBlockedOperations([1]);
    await refreshOutboxStatus(vault.db);

    view();

    expect(
      await screen.findByText("1 change can’t be sent after an app update."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the 1 change" })).toHaveAttribute(
      "href",
      expect.stringContaining("/sync"),
    );
    // The queue row says why it is not moving instead of the last error.
    expect(screen.getByText("1 · blocked")).toBeInTheDocument();
    expect(screen.getByText("Blocked by an app update")).toBeInTheDocument();
    expect(screen.queryByText("Last error: NETWORK")).not.toBeInTheDocument();
  });

  // F-54: nobody could tell when a device had finished preparing; "Last synced" only ever spoke
  // for the data, never for the screens.
  it("says the device is ready when both the data and the screens are here", async () => {
    warmScreens(SHELL_SCREENS);
    const vault = await openTestVault("u1");
    await vault.db.put("meta", { key: "syncedAt", value: "2026-09-06T10:00:00.000Z" });
    setCurrentVault(vault);

    view();

    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(
      screen.getByText("Your data and the app’s screens are on this device"),
    ).toBeInTheDocument();
  });

  it("counts the screens while it is still preparing", async () => {
    warmScreens(18);
    const vault = await openTestVault("u1");
    await vault.db.put("meta", { key: "syncedAt", value: "2026-09-06T10:00:00.000Z" });
    setCurrentVault(vault);

    view();

    expect(
      await screen.findByText(
        `Copying your data and the app’s screens · 18 of ${SHELL_SCREENS} screens`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Preparing…")).toBeInTheDocument();
  });

  it("is not ready on the screens alone: the data is the other half", async () => {
    warmScreens(SHELL_SCREENS);
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    view();

    expect(
      await screen.findByText(
        `Copying your data and the app’s screens · ${SHELL_SCREENS} of ${SHELL_SCREENS} screens`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Preparing…")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
  });

  // F-41: without a session nothing below this row reaches the server, so the screen says so and
  // offers the way back instead of leaving "Sign out" as the only door.
  it("says the session is gone and offers to sign in again", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    view();
    expect(await screen.findByText("Active")).toBeInTheDocument();
    act(() => {
      tabChannel.emitLocal({ type: "session:expired" });
    });

    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(
      screen.getByText("Signed out on this device, so nothing is syncing"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to sync" })).toHaveAttribute(
      "href",
      expect.stringContaining("/login?reauth=1"),
    );
  });

  it("says the session is alive when it is", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    view();

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to sync" })).not.toBeInTheDocument();
  });

  // F-30: the tray got its own route in O-F5a part 2 and nothing linked to it from Settings.
  it("links to the tray of stuck changes", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);
    view();
    const link = await screen.findByRole("link", { name: /Changes that need you/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("/sync"));
  });

  it("keeps the queue when it throws the copy away", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account({ id: "a1" })));
    await vault.db.put("outbox", operation(1));
    setCurrentVault(vault);
    await refreshOutboxStatus(vault.db);
    view();

    await userEvent.click(await screen.findByRole("button", { name: /Force full resync/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Resync now" }));

    await waitFor(async () => {
      expect(await vault.db.count("accounts")).toBe(0);
    });
    // The queue is the only place unsent work exists (invariant 7).
    expect(await vault.db.count("outbox")).toBe(1);
  });
});

describe("Sync status with no network", () => {
  afterEach(() => {
    reportOnline(true);
  });

  it("says what is missing is paused, not slow", async () => {
    warmScreens(18);
    const vault = await openTestVault("u1");
    await vault.db.put("meta", { key: "syncedAt", value: "2026-09-06T10:00:00.000Z" });
    setCurrentVault(vault);
    reportOnline(false);

    view();

    expect(await screen.findByText("Incomplete")).toBeInTheDocument();
    expect(await screen.findByText("Paused: it needs a connection to finish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("will not throw the copy away when it cannot download a new one", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);
    reportOnline(false);
    view();

    expect(await screen.findByRole("button", { name: /Force full resync/ })).toBeDisabled();
    expect(screen.getByText(/Needs a connection/)).toBeInTheDocument();
  });
});
