import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { sectionOf } from "@/features/shared/ledger";
import { resetOutboxStatus } from "@/lib/local/outbox";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import {
  contact,
  queueWrite,
  settlement,
  sharedExpense,
  sharedGroup,
  transaction,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { SharedExpenseCard } from "./SharedExpenseCard";

const ANA = "k1";
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/transactions",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      json({
        data: [],
        pagination: { limit: 20, offset: 0, total: 0, hasMore: false, nextCursor: null },
      }),
    ),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetOutboxStatus();
  await wipeVaults();
});

const share = (over: Partial<SharedShare> & { amount: number }): SharedShare => ({
  party: "CONTACT",
  contactId: null,
  percent: null,
  fixedAmount: null,
  collected: 0,
  ...over,
});

const withTotals = (row: SyncSharedGroup): SharedGroup => ({
  ...row,
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
});

const expense = sharedExpense({
  id: "s1",
  description: "Food",
  amount: 100_000,
  split: {
    mode: "EQUAL",
    guests: null,
    shares: [
      share({ party: "USER", contactId: null, amount: 50_000 }),
      share({ contactId: ANA, amount: 50_000 }),
    ],
  },
});

function render(collected: number) {
  const section = sectionOf(
    {
      groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
      undone: [],
      dropped: [],
      expenses: [expense],
      settlements:
        collected > 0
          ? [
              settlement({
                id: "p1",
                counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
                collected,
              }),
            ]
          : [],
    },
    [contact({ id: ANA, name: "Ana Ruiz" })],
  );
  const [view] = section.groups;
  if (!view) throw new Error("no group");
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SharedExpenseCard
          row={{
            ...transaction({ id: "t1", amount: 100_000 }),
            sharedExpenseId: "s1",
            sharedGroupId: "g1",
            sharedHistory: [
              { at: "2026-08-12T00:00:00.000Z", reason: "SPLIT", countsAsYours: 100_000 },
              { at: "2026-08-18T00:00:00.000Z", reason: "PAYMENT", countsAsYours: 50_000 },
            ],
          }}
          section={section}
          view={view}
          expense={expense}
        />
      </ToastProvider>
    </QueryProvider>,
  );
}

// A block of guests lives in this expense alone, so this is the only place its payments are read (T-138).
function renderWithGuests() {
  const withGuests = sharedExpense({
    id: "s1",
    description: "Beach club",
    amount: 230_000,
    split: {
      mode: "EQUAL",
      guests: { count: 20, name: null },
      shares: [
        share({ party: "USER", contactId: null, amount: 10_000 }),
        share({ contactId: ANA, amount: 20_000 }),
        share({ party: "GUESTS", contactId: null, amount: 200_000 }),
      ],
    },
  });
  const section = sectionOf(
    {
      groups: [withTotals(sharedGroup({ id: "g1", name: "Night out" }))],
      undone: [],
      dropped: [],
      expenses: [withGuests],
      settlements: [
        settlement({
          id: "p9",
          counterparty: { kind: "GUESTS", contactId: null, expenseId: "s1" },
          collected: 120_000,
        }),
      ],
    },
    [contact({ id: ANA, name: "Ana Ruiz" })],
  );
  const [view] = section.groups;
  if (!view) throw new Error("no group");
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SharedExpenseCard
          row={{
            ...transaction({ id: "t1", amount: 230_000 }),
            sharedExpenseId: "s1",
            sharedGroupId: "g1",
          }}
          section={section}
          view={view}
          expense={withGuests}
        />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("the shared card of a movement", () => {
  it("leads with what counts as yours and says how it got there", () => {
    render(50_000);

    expect(screen.getByRole("heading", { name: "Night out" })).toBeInTheDocument();
    expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/counts as yours.*Your share is .* everybody has settled/),
    ).toBeInTheDocument();
  });

  // T-140: the card follows its group, and a payment moves only its payer's row in it.
  it("marks the lead figure and the payer's row while their payment is on this device", async () => {
    await queueWrite({ entity: "settlement", entityId: "p1" });
    render(50_000);

    // What counts as yours and what Ana has paid; your own share did not move.
    expect(
      await screen.findAllByRole("img", { name: "Includes changes not yet synced" }),
    ).toHaveLength(2);
  });

  it("marks what counts as yours when the movement itself was edited here", async () => {
    await queueWrite({ entity: "transaction", entityId: "t1", action: "update" });
    render(0);

    expect(
      await screen.findAllByRole("img", { name: "Includes changes not yet synced" }),
    ).toHaveLength(1);
  });

  it("keeps the history that explains a figure falling weeks later", () => {
    render(0);

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("Split with other people")).toBeInTheDocument();
    expect(screen.getByText("Somebody paid you back")).toBeInTheDocument();
    // An event that changed nothing says so: splitting never moves the figure.
    expect(screen.getByText("no change")).toBeInTheDocument();
  });

  it("lists what a block of guests has paid, and undoes it from here", async () => {
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        (init?.method ?? "GET") === "DELETE"
          ? json({ message: "ok" })
          : json({
              data: [],
              pagination: { limit: 20, offset: 0, total: 0, hasMore: false, nextCursor: null },
            }),
      ),
    );
    renderWithGuests();

    expect(screen.getByRole("heading", { name: "Paid by the guests" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Paid you \$120,000/ }));
    const sheet = screen.getByRole("dialog", { name: "Undo this payment?" });
    expect(sheet).toHaveTextContent("The $120,000 they paid you goes back to being owed");

    await userEvent.click(screen.getByRole("button", { name: "Undo the payment" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init?.method ?? "GET") === "DELETE")).toBe(
        true,
      );
    });
  });
});
