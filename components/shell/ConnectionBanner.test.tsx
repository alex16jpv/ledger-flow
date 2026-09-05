import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
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
  connectivityStore.reset();
  setCurrentVault(null);
  await wipeVaults();
});

describe("ConnectionBanner", () => {
  it("says nothing with network and an empty queue", async () => {
    await queueOf([]);
    renderWithProviders(<ConnectionBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("counts what the queue is holding while offline", async () => {
    await queueOf([operation(1), operation(2)]);
    reportOnline(false);
    renderWithProviders(<ConnectionBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("2 changes waiting");
  });

  it("keeps the amber stripe with network while the queue has not drained", async () => {
    await queueOf([operation(1)]);
    renderWithProviders(<ConnectionBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Changes waiting to sync.");
  });

  it("turns red when an operation is in conflict, online or not", async () => {
    await queueOf([operation(1, { status: "conflict" })]);
    renderWithProviders(<ConnectionBanner />);
    expect(screen.getByRole("alert")).toHaveTextContent("1 change could not sync");
  });

  it("counts a refusal the queue could not undo as well (F-23)", async () => {
    await queueOf([
      operation(1, { status: "failed", lastError: "RESOURCE_ARCHIVED" }),
      operation(2, { status: "conflict" }),
    ]);
    renderWithProviders(<ConnectionBanner />);
    expect(screen.getByRole("alert")).toHaveTextContent("2 changes could not sync");
  });

  it("opens the first stuck operation from Review", async () => {
    await queueOf([operation(1), operation(2, { status: "conflict" })]);
    renderWithProviders(<ConnectionBanner />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent("Resolve sync conflict");
    });
  });

  it("also leads to the tray that lists every stuck operation", async () => {
    await queueOf([operation(1, { status: "conflict" }), operation(2, { status: "failed" })]);
    renderWithProviders(<ConnectionBanner />);

    await userEvent.click(screen.getByRole("button", { name: "See all" }));

    expect(push).toHaveBeenCalledWith("/sync");
  });
});
