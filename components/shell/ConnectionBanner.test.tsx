import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import {
  refreshOutboxStatus,
  resetOutboxStatus,
  resetSynced,
  setBlockedOperations,
} from "@/lib/local/outbox";
import { reportSynced } from "@/lib/local/outbox/synced";
import { setCurrentVault } from "@/lib/local/repository/read";
import type { OutboxOperation } from "@/lib/local/schema";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { setLocalOnly } from "@/lib/network/local-only";
import { activateWaitingWorker } from "@/lib/pwa/registration";
import { reportUpdateWaiting, resurfaceUpdate, updateStore } from "@/lib/pwa/update";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { ConnectionBanner, PENDING_GRACE_MS } from "./ConnectionBanner";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/home",
}));
vi.mock("@/lib/pwa/registration", () => ({ activateWaitingWorker: vi.fn() }));

function operation(seq: number, overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    seq,
    opId: `op-${seq}`,
    opVersion: 1,
    entity: "transaction",
    entityId: `t${seq}`,
    action: "create",
    occurredAt: "2026-09-04T10:00:00.000Z",
    payload: {},
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

async function queueOf(operations: OutboxOperation[]): Promise<void> {
  const vault = await openTestVault("u1");
  for (const entry of operations) await vault.db.put("outbox", entry);
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
}

afterEach(async () => {
  push.mockReset();
  resetOutboxStatus();
  resetSynced();
  connectivityStore.reset();
  updateStore.reset();
  setLocalOnly(false);
  vi.mocked(activateWaitingWorker).mockReset();
  setCurrentVault(null);
  await wipeVaults();
});

const render = (props: { signedOut?: boolean; onSignIn?: () => void } = {}) =>
  renderWithProviders(
    <ToastProvider>
      <ConnectionBanner {...props} />
    </ToastProvider>,
  );

describe("ConnectionBanner", () => {
  it("says nothing with network and an empty queue", async () => {
    await queueOf([]);
    render();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("counts what the queue is holding while offline", async () => {
    await queueOf([operation(1), operation(2)]);
    reportOnline(false);
    render();
    expect(screen.getByRole("status")).toHaveTextContent("2 changes waiting");
  });

  // Real timers: faking `setTimeout` before rendering deadlocks React's scheduler under jsdom.
  it("says nothing about a queue that has not been waiting long enough", async () => {
    await queueOf([operation(1)]);
    render();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.getByRole("status")).toHaveTextContent("Changes waiting to sync.");
      },
      { timeout: PENDING_GRACE_MS * 3 },
    );

    // The grace is forgotten when the queue drains, or the next write would inherit it.
    act(() => {
      resetOutboxStatus();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await queueOf([operation(2)]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // The grace exists for a round trip nobody is waiting on, not for a queue that is stuck.
  it("says it straight away when the last round failed", async () => {
    await queueOf([operation(1, { lastError: "NETWORK" })]);
    render();
    expect(screen.getByRole("status")).toHaveTextContent("Changes waiting to sync.");
  });

  it("turns red when an operation is in conflict, online or not", async () => {
    await queueOf([operation(1, { status: "conflict" })]);
    render();
    expect(screen.getByRole("alert")).toHaveTextContent("1 change could not sync");
  });

  it("counts a refusal the queue could not undo as well (F-23)", async () => {
    await queueOf([
      operation(1, { status: "failed", lastError: "RESOURCE_ARCHIVED" }),
      operation(2, { status: "conflict" }),
    ]);
    render();
    expect(screen.getByRole("alert")).toHaveTextContent("2 changes could not sync");
  });

  it("opens the first stuck operation from Review", async () => {
    await queueOf([operation(1), operation(2, { status: "conflict" })]);
    render();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent("Resolve sync conflict");
    });
  });

  // F-41: §8.12 puts this above `error` — conflicts change nothing until there is a session.
  it("says the session is gone and offers the way back", async () => {
    await queueOf([operation(1)]);
    const onSignIn = vi.fn();
    render({ signedOut: true, onSignIn });

    expect(screen.getByRole("status")).toHaveTextContent("You’re signed out. Nothing is syncing.");
    expect(screen.getByRole("status")).toHaveTextContent("1 change is saved on this device");

    await userEvent.click(screen.getByRole("button", { name: "Sign in to sync" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("does not count a queue that is empty", async () => {
    await queueOf([]);
    render({ signedOut: true, onSignIn: vi.fn() });
    expect(screen.getByRole("status")).not.toHaveTextContent("saved on this device");
  });

  it("wins over the conflicts, and loses to having no network (§8.12)", async () => {
    await queueOf([operation(1, { status: "conflict" })]);
    render({ signedOut: true, onSignIn: vi.fn() });
    expect(screen.getByRole("status")).toHaveTextContent("You’re signed out.");

    reportOnline(false);
    expect(await screen.findByRole("status")).toHaveTextContent("You’re offline.");
  });

  // F-65: a queue that can never go out looked exactly like one that had not gone out yet.
  it("says an app update stopped changes from being sent, above everything but the network", async () => {
    await queueOf([operation(1), operation(2, { status: "conflict" })]);
    setBlockedOperations([1]);
    render({ signedOut: true, onSignIn: vi.fn() });

    const stripe = screen.getByRole("alert");
    expect(stripe).toHaveTextContent("An app update stopped 1 change from being sent.");
    expect(stripe).toHaveTextContent("They are still saved on this device.");

    await userEvent.click(screen.getByRole("button", { name: "See them" }));
    expect(push).toHaveBeenCalledWith("/sync");

    reportOnline(false);
    expect(await screen.findByRole("status")).toHaveTextContent("You’re offline.");
  });

  // F-62: the text existed since W-19 and the stripe never painted it.
  it("counts what the round drained on the green stripe", async () => {
    await queueOf([]);
    reportSynced(
      new Map([
        [1, { kind: "sent", result: null }],
        [2, { kind: "absorbed", into: 1 }],
      ]),
    );
    reportOnline(false);
    reportOnline(true);
    render();

    const stripe = await screen.findByRole("status");
    expect(stripe).toHaveTextContent("Back online.");
    expect(stripe).toHaveTextContent("2 changes synced");
  });

  it("never says zero changes synced", async () => {
    await queueOf([]);
    reportSynced(new Map([[1, { kind: "cancelled" }]]));
    reportOnline(false);
    reportOnline(true);
    render();

    const stripe = await screen.findByRole("status");
    expect(stripe).toHaveTextContent("Back online.");
    expect(stripe).not.toHaveTextContent("synced");
  });

  // T-196: a five-second toast that a Saved replaced left the app on an old version for days.
  it("says a new version is ready until it is reloaded or put away, and brings it back", async () => {
    render();
    act(() => {
      reportUpdateWaiting();
    });

    const stripe = screen.getByRole("status");
    expect(stripe).toHaveTextContent("A new version of Ledger Flow is ready.");
    expect(stripe).toHaveTextContent("Reloading takes a second. Nothing you saved is lost.");

    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => {
      expect(activateWaitingWorker).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      resurfaceUpdate();
    });
    expect(screen.getByRole("status")).toHaveTextContent("A new version of Ledger Flow is ready.");
  });

  it("waits behind what the user must act on, and goes before a queue still draining", async () => {
    await queueOf([operation(1, { lastError: "NETWORK" })]);
    reportUpdateWaiting();
    render();
    expect(screen.getByRole("status")).toHaveTextContent("A new version of Ledger Flow is ready.");

    await queueOf([operation(2, { status: "conflict" })]);
    expect(screen.getByRole("alert")).toHaveTextContent("1 change could not sync");
    expect(screen.queryByText("A new version of Ledger Flow is ready.")).not.toBeInTheDocument();

    reportOnline(false);
    expect(await screen.findByRole("status")).toHaveTextContent("You’re offline.");
  });

  it("goes before an app update's blocked queue and never before back online", async () => {
    await queueOf([operation(1)]);
    setBlockedOperations([1]);
    reportUpdateWaiting();
    render();
    expect(screen.getByRole("alert")).toHaveTextContent("An app update stopped 1 change");

    act(() => {
      setBlockedOperations([]);
      resetOutboxStatus();
    });
    reportOnline(false);
    reportOnline(true);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "A new version of Ledger Flow is ready.",
    );
  });

  // T-196: this device only lasts until the user leaves it, so the notice cannot wait behind it.
  it("shows on a device working on its own, and gives the slot back when put away", async () => {
    setLocalOnly(true);
    reportUpdateWaiting();
    renderWithProviders(
      <main id="main" tabIndex={-1}>
        <ConnectionBanner />
      </main>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A new version of Ledger Flow is ready.");

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.getByRole("status")).toHaveTextContent("You’re working on this device only.");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("also leads to the tray that lists every stuck operation", async () => {
    await queueOf([operation(1, { status: "conflict" }), operation(2, { status: "failed" })]);
    render();

    await userEvent.click(screen.getByRole("button", { name: "See all" }));

    expect(push).toHaveBeenCalledWith("/sync");
  });
});
