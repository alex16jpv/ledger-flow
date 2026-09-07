import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { dayKey } from "@/lib/format/dates";
import { rememberServerTime, resetClockOffset } from "@/lib/local/clock";
import { pendingOperations, refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import { setCurrentVault } from "@/lib/local/repository/read";
import {
  accountRecord,
  categoryRecord,
  type OutboxOperation,
  profileRecord,
  transactionRecord,
} from "@/lib/local/schema";
import { renderWithProviders } from "@/lib/testing/render";
import {
  account,
  category,
  openTestVault,
  profile,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";

import { SyncConflictSheet } from "./SyncConflictSheet";

const DAY = 24 * 60 * 60 * 1000;
const T0 = "2026-08-01T10:00:00.000Z";
const T1 = "2026-09-04T12:00:00.000Z";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response("{}", { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  resetOutboxStatus();
  setCurrentVault(null);
  vi.unstubAllGlobals();
  await wipeVaults();
});

async function vaultWith(operations: Partial<OutboxOperation>[]) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("accounts", accountRecord(account({ id: "a1", name: "Cash" })));
  await vault.db.put("categories", categoryRecord(category({ id: "c9", name: "Groceries" })));
  await vault.db.put(
    "transactions",
    transactionRecord(transaction({ id: "t1", amount: 15, updatedAt: T0 })),
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
      payload: { body: { amount: 15, categoryId: "c9" } },
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

const server = transaction({ id: "t1", amount: 42, categoryId: "c9", updatedAt: T1 });

describe("the Resolve sync conflict sheet", () => {
  it("says it is reading the queue before it can show anything", async () => {
    await vaultWith([{ serverRow: server }]);
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(screen.getByText("Reading what’s waiting…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("On the server")).toBeInTheDocument();
    });
  });

  it("puts the two versions side by side and highlights the field in dispute", async () => {
    await vaultWith([{ serverRow: server }]);
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    const cards = await screen.findAllByRole("heading", { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual(["On the server", "On this device"]);
    // The category both sides agree on is shown by name, not by id, and is not in dispute.
    expect(screen.getAllByText("Groceries")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Keep this device’s version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use the server’s version" })).toBeInTheDocument();
  });

  it("keeps the server's version by discarding the operation, and never sends it", async () => {
    const vault = await vaultWith([{ serverRow: server }]);
    const onClose = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={onClose} />
      </ToastProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Use the server’s version" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(await pendingOperations(vault.db)).toEqual([]);
    expect((await vault.db.get("transactions", "t1"))?.row.amount).toBe(42);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a definitive refusal with its reason and offers discarding first", async () => {
    await vaultWith([{ status: "failed", lastError: "RESOURCE_ARCHIVED", serverRow: undefined }]);
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(await screen.findByText(/RESOURCE_ARCHIVED/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /Discard this change|Try again/ });
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Discard this change",
      "Try again",
    ]);
    expect(screen.queryByText("On the server")).not.toBeInTheDocument();
  });

  it("says there is nothing left when the operation is no longer waiting", async () => {
    await vaultWith([]);
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(await screen.findByText("Nothing left to resolve")).toBeInTheDocument();
    // The sheet's own dismiss and the footer's way out.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("warns before overwriting a server version it was never told", async () => {
    await vaultWith([{ serverRow: undefined }]);
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(await screen.findByText(/The server didn’t say what it has/)).toBeInTheDocument();
    expect(screen.queryByText("On the server")).not.toBeInTheDocument();
    expect(screen.getByText("On this device")).toBeInTheDocument();
  });
  it("offers restoring the account a movement is stuck on, ahead of the movement (F-58)", async () => {
    const vault = await vaultWith([
      {
        action: "create",
        payload: { body: { id: "t1", amount: 15, fromAccountId: "a1" } },
        lastError: "RESOURCE_ARCHIVED",
        archivedId: "a1",
        serverRow: undefined,
      },
    ]);
    await vault.db.put(
      "accounts",
      accountRecord(account({ id: "a1", name: "Cash", archivedAt: T1 })),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ serverTime: T1, results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(await screen.findByText(/archived on another device/)).toBeInTheDocument();
    // The row it needs is named, and trying again as it is is not offered: it would be refused again.
    expect(screen.getAllByText("Cash").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Keep this device’s version" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Restore the account" }));

    await waitFor(async () => {
      expect((await pendingOperations(vault.db)).map((entry) => entry.seq)).toEqual([0.5, 1]);
    });
    const [restore, movement] = await pendingOperations(vault.db);
    expect(restore).toMatchObject({ entity: "account", action: "restore", entityId: "a1" });
    expect(movement).toMatchObject({ status: "pending", dependsOn: ["a1"] });
  });

  // F-60: the tray's "Try again" repeated the same refusal for good. The restore route takes a
  // `name`, so the way through is asking for one.
  it("offers restoring under another name when the name is taken", async () => {
    const vault = await vaultWith([
      {
        entity: "account",
        entityId: "a1",
        action: "restore",
        payload: { body: {} },
        lastError: "DUPLICATE",
        serverRow: account({ id: "a7", name: "Cash", updatedAt: T1 }),
        baseUpdatedAt: undefined,
      },
    ]);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ serverTime: T1, results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    expect(await screen.findByText("The name is taken.")).toBeInTheDocument();
    const cards = screen.getAllByRole("heading", { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual([
      "On the server · has the name",
      "On this device · being restored",
    ]);
    // Repeating the same name would be refused again, so it is not on offer, and the sheet says so.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByText(/would be refused again/)).toBeInTheDocument();

    const field = screen.getByRole("textbox", { name: "New name" });
    expect(field).toHaveValue("Cash (old)");

    await userEvent.click(screen.getByRole("button", { name: "Restore as “Cash (old)”" }));

    await waitFor(async () => {
      expect((await pendingOperations(vault.db))[0]).toMatchObject({ status: "pending" });
    });
    const [queued] = await pendingOperations(vault.db);
    expect(queued?.payload).toMatchObject({ body: { name: "Cash (old)" } });
    expect(queued?.serverRow).toBeUndefined();
    // The mirror shows the name it is being restored under from the moment the user chose it.
    expect((await vault.db.get("accounts", "a1"))?.row.name).toBe("Cash (old)");
  });

  it("takes the name the user typed over the one it suggested", async () => {
    const vault = await vaultWith([
      {
        entity: "account",
        entityId: "a1",
        action: "restore",
        payload: { body: {} },
        lastError: "DUPLICATE",
        serverRow: account({ id: "a7", name: "Cash", updatedAt: T1 }),
        baseUpdatedAt: undefined,
      },
    ]);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ serverTime: T1, results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    const field = await screen.findByRole("textbox", { name: "New name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Petty cash");
    await userEvent.click(screen.getByRole("button", { name: "Restore as “Petty cash”" }));

    await waitFor(async () => {
      expect((await pendingOperations(vault.db))[0]?.payload).toMatchObject({
        body: { name: "Petty cash" },
      });
    });
  });

  // F-66: the card and the sheet could only discard or repeat a refusal the date itself caused.
  it("corrects the date the server refused and sends the same movement again", async () => {
    const vault = await vaultWith([
      {
        action: "create",
        payload: { body: { id: "t1", amount: 15, date: "2026-09-25T18:10:00.000Z" } },
        status: "failed",
        lastError: "FUTURE_DATE",
        serverRow: undefined,
        baseUpdatedAt: undefined,
      },
    ]);
    await rememberServerTime(
      vault.db,
      "2026-09-22T18:12:00.000Z",
      Date.parse("2026-09-25T18:12:00.000Z"),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ serverTime: T1, results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    renderWithProviders(
      <ToastProvider>
        <SyncConflictSheet open seq={1} onClose={vi.fn()} />
      </ToastProvider>,
    );

    // The sheet stops being a comparison and becomes a correction.
    expect(await screen.findByText("Fix the date")).toBeInTheDocument();
    expect(screen.getByText(/more than 24 hours ahead of the server’s time/)).toBeInTheDocument();
    expect(screen.getByText(/clock is 3 days ahead/)).toBeInTheDocument();
    expect(screen.getByText("Was Sep 25 1:10 PM")).toBeInTheDocument();
    // Prefilled with the server's own clock — three days behind this device's — and never with the
    // date that was refused.
    const onTheServer = dayKey(new Date(Date.now() - 3 * DAY), "America/Bogota");
    await userEvent.click(screen.getByRole("button", { name: /^Date/ }));
    const calendar = screen.getByRole("dialog", { name: "Date" });
    const selected = within(calendar)
      .getAllByRole("gridcell")
      .find((cell) => cell.getAttribute("aria-selected") === "true");
    expect(selected).toHaveTextContent(String(Number(onTheServer.slice(8))));
    await userEvent.click(within(calendar).getByRole("button", { name: "Cancel" }));

    await userEvent.click(screen.getByRole("button", { name: "Save and try again" }));

    await waitFor(async () => {
      expect((await pendingOperations(vault.db))[0]).toMatchObject({ status: "pending" });
    });
    const [queued] = await pendingOperations(vault.db);
    const sent = (queued?.payload as { body: { date: string } }).body.date;
    expect(dayKey(new Date(sent), "America/Bogota")).toBe(onTheServer);
    resetClockOffset();
  });
});
