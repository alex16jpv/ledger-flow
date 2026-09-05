import { screen } from "@testing-library/react";

import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import type { OutboxOperation } from "@/lib/local/schema";
import { renderWithProviders } from "@/lib/testing/render";
import { account, category, openTestVault, transaction, wipeVaults } from "@/lib/testing/vault";
import type { Account, Category } from "@/types/api";

import { TransactionRow } from "./TransactionRow";

const lookups = {
  accounts: new Map<string, Account>([["a1", account({ id: "a1", name: "Cash" })]]),
  categories: new Map<string, Category>([["c1", category({ id: "c1", name: "Dining" })]]),
};

const row = () => ({
  ...transaction({ id: "t1", description: "Lunch", fromAccountId: "a1" }),
  pendingReview: false,
  pendingDetails: false,
});

async function queueOf(operations: Partial<OutboxOperation>[]): Promise<void> {
  const vault = await openTestVault("u1");
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
      payload: {},
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
      ...overrides,
    });
  }
  await refreshOutboxStatus(vault.db);
}

afterEach(async () => {
  resetOutboxStatus();
  await wipeVaults();
});

describe("a movement row", () => {
  it("says nothing about syncing when the queue does not hold it", async () => {
    await queueOf([{ entityId: "t9" }]);
    renderWithProviders(<TransactionRow transaction={row()} lookups={lookups} onOpen={vi.fn()} />);

    expect(screen.queryByText("Pending sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });

  it("carries the Pending sync badge while its own write is waiting (F-16)", async () => {
    await queueOf([{}]);
    renderWithProviders(<TransactionRow transaction={row()} lookups={lookups} onOpen={vi.fn()} />);

    expect(screen.getByText("Pending sync")).toBeInTheDocument();
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  it("says it needs attention once the server refused its write", async () => {
    await queueOf([{ status: "conflict", lastError: "STALE_UPDATE" }]);
    renderWithProviders(<TransactionRow transaction={row()} lookups={lookups} onOpen={vi.fn()} />);

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByText("Pending sync")).not.toBeInTheDocument();
  });
});
