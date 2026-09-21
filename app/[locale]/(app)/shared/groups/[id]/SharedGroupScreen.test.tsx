import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare } from "@/types/api";

import { SharedGroupScreen } from "./SharedGroupScreen";

const ANA = "k1";
const BETO = "k2";

const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

const share = (over: Partial<SharedShare> & { amount: number }): SharedShare => ({
  party: "CONTACT",
  contactId: null,
  percent: null,
  fixedAmount: null,
  collected: 0,
  ...over,
});

const three = (amount: number) => ({
  mode: "EQUAL" as const,
  guests: null,
  shares: [
    share({ party: "USER", contactId: null, amount: amount / 3 }),
    share({ contactId: ANA, amount: amount / 3 }),
    share({ contactId: BETO, amount: amount / 3 }),
  ],
});

const group: SharedGroup = {
  ...sharedGroup({
    id: "g1",
    name: "Night out",
    participants: [
      { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
      { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
      { contactId: BETO, addedAt: "2026-08-01T00:00:00.000Z" },
    ],
  }),
  status: "OPEN",
  totals: {
    amount: 210_000,
    yourShare: 70_000,
    owedToYou: 80_000,
    writtenOff: 0,
    youOwe: 30_000,
    collected: 0,
    expenseCount: 2,
    dateFrom: "2026-08-10T20:00:00.000Z",
    dateTo: "2026-08-10T20:00:00.000Z",
  },
};

const expenses = [
  sharedExpense({ id: "s1", description: "Food", amount: 120_000, split: three(120_000) }),
  sharedExpense({
    id: "s2",
    description: "Tickets",
    amount: 90_000,
    paidByContactId: ANA,
    split: three(90_000),
  }),
];

const contacts = [contact({ id: ANA, name: "Ana Ruiz" }), contact({ id: BETO, name: "Beto Cano" })];

const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared/groups/g1",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (url.startsWith("/api/contacts")) return Promise.resolve(page(contacts));
    if (url.includes("/expenses")) return Promise.resolve(page(expenses));
    if (url.startsWith("/api/settlements")) return Promise.resolve(page([]));
    return Promise.resolve(page([group]));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SharedGroupScreen id="g1" />
      </ToastProvider>
    </QueryProvider>,
  );

describe("SharedGroupScreen", () => {
  it("leads with what still counts as yours, not with what the outing cost", async () => {
    view();

    // 120,000 left your accounts and nothing has come back; the tickets are Ana's money.
    const lead = await screen.findByText(/counts as yours/);
    expect(lead.parentElement).toHaveTextContent("$120,000");
    expect(lead).toHaveTextContent("total $210,000");
    expect(lead).toHaveTextContent("your share $70,000");
  });

  it("draws you as a row like everybody else, and says who has paid", async () => {
    view();

    const people = await screen.findByRole("heading", { name: "People" });
    const list = people.parentElement?.parentElement;
    expect(list).toHaveTextContent("You");
    expect(list).toHaveTextContent("Ana Ruiz");
    expect(list).toHaveTextContent("Beto Cano");
    expect(screen.getAllByText("Not paid").length).toBeGreaterThan(0);
  });

  // A line somebody else paid is not an expense of yours until you settle with them.
  it("says a line somebody else paid is not in your ledger", async () => {
    view();

    expect(await screen.findByText("Tickets")).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz paid")).toBeInTheDocument();
    expect(screen.getByText("not in your ledger")).toBeInTheDocument();
  });
});
