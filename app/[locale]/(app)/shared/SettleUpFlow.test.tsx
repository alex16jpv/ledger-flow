import { screen, within } from "@testing-library/react";

import { sectionOf } from "@/features/shared/ledger";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare } from "@/types/api";

import { SettleUpFlow } from "./SettleUpFlow";

const share = (over: Partial<SharedShare> & { amount: number }): SharedShare => ({
  party: "CONTACT",
  contactId: null,
  percent: null,
  fixedAmount: null,
  collected: 0,
  ...over,
});

const group: SharedGroup = {
  ...sharedGroup({ id: "g1", name: "Night out" }),
  status: "OPEN",
  totals: {
    amount: 0,
    yourShare: 0,
    owedToYou: 0,
    writtenOff: 0,
    youOwe: 0,
    collected: 0,
    expenseCount: 0,
    dateFrom: null,
    dateTo: null,
  },
};

// Ana still owes her share; Beto handed over more than his and is owed the rest back.
function section() {
  return sectionOf(
    {
      groups: [group],
      expenses: [
        sharedExpense({
          id: "s1",
          amount: 90_000,
          split: {
            mode: "EQUAL",
            guests: null,
            shares: [
              share({ party: "USER", amount: 30_000 }),
              share({ contactId: "k1", amount: 30_000 }),
              share({ contactId: "k2", amount: 30_000 }),
            ],
          },
        }),
      ],
      settlements: [
        settlement({
          counterparty: { kind: "CONTACT", contactId: "k2", expenseId: null },
          collected: 50_000,
        }),
      ],
      undone: [],
      dropped: [],
    },
    [contact({ id: "k1", name: "Ana Ruiz" }), contact({ id: "k2", name: "Beto Cano" })],
  );
}

describe("SettleUpFlow", () => {
  it("asks who first, each row saying what its sheet would settle and in which direction", () => {
    const shared = section();
    const view = shared.groups[0];
    if (!view) throw new Error("the group has a view");
    renderWithProviders(
      <SettleUpFlow section={shared} view={view} parties={view.people} open onClose={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Who are you settling with?" })).toBeVisible();
    const ana = screen.getByRole("button", { name: /Ana Ruiz/ });
    expect(within(ana).getByText("owes you")).toBeVisible();
    expect(within(ana).getByText(/30,000/)).toBeVisible();
    const beto = screen.getByRole("button", { name: /Beto Cano/ });
    expect(within(beto).getByText("you owe")).toBeVisible();
    expect(within(beto).getByText(/20,000/)).toBeVisible();
  });
});
