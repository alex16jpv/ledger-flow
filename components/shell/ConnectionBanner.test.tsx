import { screen, waitFor } from "@testing-library/react";
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
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { ConnectionBanner } from "./ConnectionBanner";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/home",
}));

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

  it("keeps the amber stripe with network while the queue has not drained", async () => {
    await queueOf([operation(1)]);
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

  // F-41: with the session dead the stripe is the only way back to the login once the sheet is
  // closed, and §8.12 puts it above `error` — resolving conflicts changes nothing until there is a
  // session to send them with.
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

  // F-65: `openVault` reported a blocked outbox and nobody read it, so a queue that could never go
  // out looked exactly like one that had not gone out yet.
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

  // F-62: the text has existed in `messages/` since W-19 and the stripe never painted it, so the
  // only sign the queue emptied was the amber one disappearing.
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

  it("also leads to the tray that lists every stuck operation", async () => {
    await queueOf([operation(1, { status: "conflict" }), operation(2, { status: "failed" })]);
    render();

    await userEvent.click(screen.getByRole("button", { name: "See all" }));

    expect(push).toHaveBeenCalledWith("/sync");
  });
});
