import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import type { Transaction } from "@/types/api";

import { TransactionPickerSheet } from "./TransactionPickerSheet";

const fetchMock = vi.fn<typeof fetch>();

const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 20, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

function expense(id: string, description: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: "EXPENSE",
    amount: 100_000,
    date: "2026-09-20T20:00:00.000Z",
    dayKey: "2026-09-20",
    description,
    note: null,
    tags: [],
    categoryId: null,
    fromAccountId: "a1",
    toAccountId: null,
    countsAsYours: 100_000,
    sharedExpenseId: null,
    sharedGroupId: null,
    sharedSettlementId: null,
    sharedHistory: [],
    pendingDetails: false,
    source: "MANUAL",
    userId: "u1",
    currency: "COP",
    createdAt: "2026-09-20T20:00:00.000Z",
    updatedAt: "2026-09-20T20:00:00.000Z",
    ...extra,
  };
}

const food = expense("t1", "Food");
const fuel = expense("t2", "Fuel");
// A movement already in a group is one line, in one group: it is not offered again.
const shared = expense("t3", "Hotel", { sharedExpenseId: "s1", sharedGroupId: "g1" });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      urlOf(input).startsWith("/api/transactions") ? page([food, fuel, shared]) : page([]),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TransactionPickerSheet", () => {
  it("offers what is not in a group yet, and keeps what was already chosen", async () => {
    const onDone = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <TransactionPickerSheet open selected={[food]} onClose={vi.fn()} onDone={onDone} />
      </QueryProvider>,
    );

    expect(await screen.findByRole("checkbox", { name: /Food/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /Hotel/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /Fuel/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Add 2 · / }));

    const [chosen] = onDone.mock.calls[0] as [Transaction[]];
    expect(chosen.map((row) => row.id)).toEqual(["t1", "t2"]);
  });

  // The other way in, and only where there is a group to record it into (T-137).
  it("offers to record a new one where a group exists, and nowhere else", async () => {
    const onRecordNew = vi.fn();
    const { unmount } = renderWithProviders(
      <QueryProvider>
        <TransactionPickerSheet open onClose={vi.fn()} onDone={vi.fn()} />
      </QueryProvider>,
    );
    expect(await screen.findByRole("checkbox", { name: /Food/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record a new expense" })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <QueryProvider>
        <TransactionPickerSheet open onClose={vi.fn()} onDone={vi.fn()} onRecordNew={onRecordNew} />
      </QueryProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Record a new expense" }));
    expect(onRecordNew).toHaveBeenCalledOnce();
  });

  it("says the list could not be read rather than that there is nothing to add", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    renderWithProviders(
      <QueryProvider>
        <TransactionPickerSheet open onClose={vi.fn()} onDone={vi.fn()} />
      </QueryProvider>,
    );

    expect(await screen.findByText(/could not be read/)).toBeInTheDocument();
    expect(screen.queryByText(/already in a shared group/)).not.toBeInTheDocument();
  });
});
