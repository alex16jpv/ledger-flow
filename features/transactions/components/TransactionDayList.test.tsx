import { act, screen } from "@testing-library/react";

import { rememberServerTime, resetClockOffset } from "@/lib/local/clock";
import type { VaultDb } from "@/lib/local/outbox/queue";
import { renderWithProviders } from "@/lib/testing/render";
import { account, category, transaction } from "@/lib/testing/vault";
import type { Account, Category } from "@/types/api";

import { TransactionDayList } from "./TransactionDayList";

const lookups = {
  accounts: new Map<string, Account>([["a1", account({ id: "a1", name: "Cash" })]]),
  categories: new Map<string, Category>([["c1", category({ id: "c1", name: "Dining" })]]),
};

const row = (date: string) => ({
  ...transaction({ id: "t1", description: "Lunch", fromAccountId: "a1", date }),
  pendingReview: false,
  pendingDetails: false,
});

const vault = { put: vi.fn() } as unknown as VaultDb;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T17:00:00.000Z"));
});

afterEach(() => {
  resetClockOffset();
  vi.useRealTimers();
});

describe("TransactionDayList (T-163)", () => {
  it("calls the server's day today, whatever this device's clock says", async () => {
    await act(() => rememberServerTime(vault, "2026-10-02T17:00:00.000Z"));

    renderWithProviders(
      <TransactionDayList
        transactions={[row("2026-10-02T15:00:00.000Z")]}
        lookups={lookups}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
  });
});
