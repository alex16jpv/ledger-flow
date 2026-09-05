import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import { setCurrentVault } from "@/lib/local/repository";
import { accountRecord, type OutboxOperation } from "@/lib/local/schema";
import { reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
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

afterEach(async () => {
  setCurrentVault(null);
  resetOutboxStatus();
  await wipeVaults();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SyncStatusView />
      </ToastProvider>
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

  it("will not throw the copy away when it cannot download a new one", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);
    reportOnline(false);
    view();

    expect(await screen.findByRole("button", { name: /Force full resync/ })).toBeDisabled();
    expect(screen.getByText(/Needs a connection/)).toBeInTheDocument();
  });
});
