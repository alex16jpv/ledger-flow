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
  // T-98: a quick capture with nothing else to show read "Quick expense", whatever its type.
  it.each([
    ["EXPENSE" as const, "Quick expense"],
    ["INCOME" as const, "Quick income"],
  ])("names an unnamed quick %s after its own type", (type, title) => {
    renderWithProviders(
      <TransactionRow
        transaction={{
          ...row(),
          type,
          description: null,
          categoryId: null,
          source: "QUICK",
          ...(type === "INCOME" ? { fromAccountId: null, toAccountId: "a1" } : {}),
        }}
        lookups={lookups}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(title)).toBeVisible();
  });

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

  // T-140: put into a group with no network, its Shared badge and its share are the queue's.
  it("waits with the group's expense its movement was put into offline", async () => {
    await queueOf([{ entity: "sharedExpense", entityId: "s1", action: "create" }]);
    renderWithProviders(
      <TransactionRow
        transaction={{ ...row(), sharedExpenseId: "s1", sharedGroupId: "g1" }}
        lookups={lookups}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending sync")).toBeInTheDocument();
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  // The row keeps the gross amount — that is what left the account — and says your share under it.
  it("keeps the whole amount on a shared expense and says your share underneath", () => {
    renderWithProviders(
      <TransactionRow
        transaction={{ ...row(), amount: 78_900, sharedExpenseId: "s1", sharedGroupId: "g1" }}
        lookups={{
          ...lookups,
          shared: {
            expenses: new Map([
              ["s1", { yourShare: 26_300, groupId: "g1", groupName: "Night out" }],
            ]),
            payments: new Map(),
          },
        }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Shared")).toBeInTheDocument();
    expect(screen.getByText("Your share $26,300")).toBeInTheDocument();
    expect(screen.getByText(/78,900/)).toBeInTheDocument();
  });

  it("reads a payment as the person it was with, neutral and with its group underneath", () => {
    renderWithProviders(
      <TransactionRow
        transaction={{
          ...row(),
          type: "SETTLEMENT",
          description: null,
          categoryId: null,
          amount: 300_000,
          fromAccountId: null,
          toAccountId: "a1",
          sharedSettlementId: "p1",
        }}
        lookups={{
          ...lookups,
          shared: {
            expenses: new Map(),
            payments: new Map([["p1", { name: "Beto Cano", groups: ["Cartagena trip"] }]]),
          },
        }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Beto Cano")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Cartagena trip")).toBeInTheDocument();
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });
});
