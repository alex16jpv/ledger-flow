import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import {
  pendingOperations,
  refreshOutboxStatus,
  resetOutboxStatus,
  resetSyncEngine,
} from "@/lib/local/outbox";
import { setCurrentVault } from "@/lib/local/repository/read";
import {
  accountRecord,
  categoryRecord,
  type OutboxOperation,
  profileRecord,
  transactionRecord,
} from "@/lib/local/schema";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { renderWithProviders } from "@/lib/testing/render";
import {
  account,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";

import { AttentionScreen } from "./AttentionScreen";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sync",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const T0 = "2026-08-01T10:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  // The tray is what is under test, not the engine: with no network a retry goes back in the queue
  // and stays there, so the assertions can look at the queue instead of racing a drain.
  reportOnline(false);
});

afterEach(async () => {
  resetSyncEngine();
  resetOutboxStatus();
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

const render = () =>
  renderWithProviders(
    <ToastProvider>
      <AttentionScreen />
    </ToastProvider>,
  );

async function vaultWith(operations: Partial<OutboxOperation>[]) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(account({ id: "a1", name: "Cash" })));
  await vault.db.put("categories", categoryRecord(category({ id: "c9", name: "Groceries" })));
  await vault.db.put(
    "transactions",
    transactionRecord(transaction({ id: "t1", amount: 15, description: "Lunch", updatedAt: T0 })),
  );
  let seq = 0;
  for (const overrides of operations) {
    seq += 1;
    await vault.db.put("outbox", {
      seq,
      opId: `op-${seq}`,
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "update",
      occurredAt: "2026-09-04T10:00:00.000Z",
      payload: { body: { amount: 15 } },
      dependsOn: [],
      status: "conflict",
      attempts: 1,
      lastError: "STALE_UPDATE",
      baseUpdatedAt: T0,
      ...overrides,
    });
  }
  await vault.db.put("meta", { key: "outboxSeq", value: seq });
  setCurrentVault(vault);
  await refreshOutboxStatus(vault.db);
  return vault;
}

const server = transaction({ id: "t1", amount: 42, updatedAt: T1 });

describe("the Needs your attention tray", () => {
  it("says it is reading the queue before it can list anything", async () => {
    await vaultWith([{ serverRow: server }]);
    render();

    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("1 change needs you")).toBeInTheDocument();
  });

  it("lists a conflict and a definitive refusal together, each with its own reason", async () => {
    await vaultWith([
      { serverRow: server },
      { seq: 2, status: "failed", lastError: "RESOURCE_ARCHIVED", action: "delete" },
    ]);
    render();

    expect(await screen.findByText("2 changes need you")).toBeInTheDocument();
    expect(screen.getByText("Changed in two places")).toBeInTheDocument();
    expect(screen.getByText("Refused by the server")).toBeInTheDocument();
    expect(screen.getByText(/changed somewhere else while this device was offline/)).toBeVisible();
    expect(screen.getByText(/It was never applied, here or there/)).toBeVisible();
    // Both rows name what they are about, and both offer the two ways out.
    expect(screen.getAllByText("Lunch")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Use the server’s version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard this change" })).toBeInTheDocument();
  });

  it("says nothing needs the user when the queue holds nothing stuck", async () => {
    await vaultWith([{ status: "pending" }]);
    render();

    expect(await screen.findByText("Nothing needs you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toBeInTheDocument();
  });

  it("offers a way back when the queue cannot be read", async () => {
    const vault = await vaultWith([{ serverRow: server }]);
    vault.db.close();
    render();

    expect(await screen.findByText("We couldn’t load this")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("says how many operations go before discarding a create with dependents", async () => {
    const vault = await vaultWith([
      { action: "create", entityId: "t2", payload: { body: { id: "t2" } } },
      { seq: 2, status: "pending", entityId: "b9", entity: "budget", dependsOn: ["t2"] },
    ]);
    render();

    await userEvent.click(await screen.findByRole("button", { name: "Use the server’s version" }));

    expect(await screen.findByText("Discard 2 changes?")).toBeInTheDocument();
    expect(screen.getByText(/1 of them was made on top of something created here/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(async () => {
      expect(await pendingOperations(vault.db)).toEqual([]);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("puts every stuck operation back in the queue in one go", async () => {
    const vault = await vaultWith([
      { serverRow: server },
      { seq: 2, serverRow: server, payload: { body: { amount: 20 } } },
    ]);
    render();

    await userEvent.click(await screen.findByRole("button", { name: "Try all again" }));

    await waitFor(async () => {
      const queue = await pendingOperations(vault.db);
      expect(queue.map((operation) => operation.status)).toEqual(["pending", "pending"]);
      // Each goes back guarded by the stamp its own 409 answered with, and with a clean count.
      expect(queue.map((operation) => operation.baseUpdatedAt)).toEqual([T1, T1]);
      expect(queue.map((operation) => operation.attempts)).toEqual([0, 0]);
    });
  });

  it("opens the sheet on the operation whose versions the user wants to compare", async () => {
    await vaultWith([{ serverRow: server }]);
    render();

    await userEvent.click(await screen.findByRole("button", { name: "Compare versions" }));

    expect(await screen.findByText("On the server")).toBeInTheDocument();
    expect(screen.getByText("On this device")).toBeInTheDocument();
  });
  it("gives a movement stuck on an archived account its own card and its own way out (F-58)", async () => {
    const vault = await vaultWith([
      {
        action: "create",
        payload: { body: { id: "t1", amount: 15, fromAccountId: "a1" } },
        lastError: "RESOURCE_ARCHIVED",
        archivedId: "a1",
      },
    ]);
    await vault.db.put(
      "accounts",
      accountRecord(account({ id: "a1", name: "Cash", archivedAt: T1 })),
    );
    render();

    expect(await screen.findByText("Account archived")).toBeInTheDocument();
    expect(screen.getByText(/archived on another device/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Keep this device’s version" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Restore the account" }));

    await waitFor(async () => {
      expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([0.5, 1]);
    });
    // With no network the two stay in the queue, in the order they will travel in.
    expect((await pendingOperations(vault.db)).map((entry) => entry.action)).toEqual([
      "restore",
      "create",
    ]);
  });
});
