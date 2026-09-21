import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { sectionOf } from "@/features/shared/ledger";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, settlement, sharedExpense, sharedGroup, transaction } from "@/lib/testing/vault";
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

afterEach(() => {
  vi.unstubAllGlobals();
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

describe("the shared card of a movement", () => {
  it("leads with what counts as yours and says how it got there", () => {
    render(50_000);

    expect(screen.getByText("Counts as yours")).toBeInTheDocument();
    expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Your share is .* everybody has settled/)).toBeInTheDocument();
  });

  it("keeps the history that explains a figure falling weeks later", () => {
    render(0);

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Split with other people")).toBeInTheDocument();
    expect(screen.getByText("Somebody paid you back")).toBeInTheDocument();
  });
});
