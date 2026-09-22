import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import type { VaultHandle } from "@/lib/local/db";
import { pendingOperations } from "@/lib/local/outbox/queue";
import { setCurrentVault } from "@/lib/local/repository/read";
import { profileRecord } from "@/lib/local/schema";
import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, profile, sharedGroup, wipeVaults } from "@/lib/testing/vault";

import { PaidByOtherSheet } from "./PaidByOtherSheet";

const ANA = "k1";
const BETO = "k2";

const group = sharedGroup({
  id: "g1",
  name: "Night out",
  participants: [null, ANA, BETO].map((contactId) => ({
    contactId,
    addedAt: "2026-08-01T00:00:00.000Z",
  })),
});

const people = [
  { contactId: ANA, name: "Ana Ruiz", color: "TEAL" as const },
  { contactId: BETO, name: "Beto Cano", color: "PURPLE" as const },
];

let vault: VaultHandle;

beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  setCurrentVault(vault);
  // The queue is what this sheet writes into; the server is not what is under test here.
  reportOnline(false);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

const onClose = vi.fn();

function open(over: Partial<React.ComponentProps<typeof PaidByOtherSheet>> = {}) {
  onClose.mockReset();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PaidByOtherSheet
          open
          group={group}
          groupName="Night out"
          people={people}
          onClose={onClose}
          {...over}
        />
      </ToastProvider>
    </QueryProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "What was it" }), "Concert tickets");
  await user.type(screen.getByRole("textbox", { name: "Amount" }), "90000");
  await user.click(screen.getByRole("button", { name: /Who paid/ }));
  await user.click(await screen.findByRole("option", { name: "Ana Ruiz" }));
}

describe("recording a line somebody else paid", () => {
  it("writes the group's expense and nothing in your ledger", async () => {
    const user = userEvent.setup();
    open();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const queued = await pendingOperations(vault.db);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entity: "sharedExpense", action: "create" });
    const body = (queued[0]?.payload as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ description: "Concert tickets", amount: 90000 });
    expect(body.paidByContactId).toBe(ANA);
    // It inherits the group's split, and carrying one is exactly what sets `customSplit`.
    expect(body.split).toBeUndefined();
    expect(body.transactionId).toBeUndefined();
  });

  it("says your share of it as soon as there is an amount to split", async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByText(/your share is \$0/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "90000");

    expect(screen.getByText(/your share is \$30,000/)).toBeInTheDocument();
  });

  it("says nothing of yours is recorded, and when that stops being true", async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByText(/Nothing of yours is recorded/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Who paid/ }));
    await user.click(await screen.findByRole("option", { name: "Beto Cano" }));

    expect(screen.getByText(/the day you settle with Beto Cano/)).toBeInTheDocument();
  });

  it("refuses a line with no description and one with nobody who paid it", async () => {
    const user = userEvent.setup();
    open();

    await user.type(screen.getByRole("textbox", { name: "Amount" }), "90000");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findAllByText("This field is required.")).not.toHaveLength(0);
    expect(await pendingOperations(vault.db)).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  // Picking yourself is what the two other ways into the group already are.
  it("offers only the other people in the group", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("button", { name: /Who paid/ }));

    expect(await screen.findByRole("option", { name: "Ana Ruiz" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "You" })).not.toBeInTheDocument();
  });
});
