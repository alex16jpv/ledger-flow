import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare } from "@/types/api";

import { PersonScreen } from "./PersonScreen";

const ANA = "k1";

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

const ana = contact({ id: ANA, name: "Ana Ruiz", email: "ana@example.com" });

const group: SharedGroup = {
  ...sharedGroup({
    id: "g1",
    name: "Night out",
    participants: [
      { contactId: null, addedAt: "2026-08-01T00:00:00.000Z" },
      { contactId: ANA, addedAt: "2026-08-01T00:00:00.000Z" },
    ],
  }),
  status: "OPEN",
  totals: {
    amount: 100_000,
    yourShare: 50_000,
    owedToYou: 30_000,
    writtenOff: 0,
    youOwe: 0,
    collected: 20_000,
    expenseCount: 1,
    dateFrom: "2026-08-10T20:00:00.000Z",
    dateTo: "2026-08-10T20:00:00.000Z",
  },
};

const expenses = [
  sharedExpense({
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
  }),
];

const paid = settlement({
  id: "p1",
  counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
  collected: 20_000,
});

const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared/people/k1",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (url.startsWith("/api/contacts/")) return Promise.resolve(json(ana));
    if (url.startsWith("/api/contacts")) return Promise.resolve(page([ana]));
    if (url.includes("/expenses")) return Promise.resolve(page(expenses));
    if (url.startsWith("/api/settlements")) return Promise.resolve(page([paid]));
    return Promise.resolve(page([group]));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PersonScreen", () => {
  it("says what is open with them, what they have paid, and that they are not an account", async () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PersonScreen id={ANA} />
        </ToastProvider>
      </QueryProvider>,
    );

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    const group = await screen.findByRole("link", { name: /Night out/ });
    expect(screen.getByText(/owes you, across/)).toBeInTheDocument();
    expect(group).toHaveTextContent("Paid $20,000 of");
    expect(screen.getByText("Paid you $20,000")).toBeInTheDocument();
    expect(screen.getByText(/A person is not an account/)).toBeInTheDocument();
  });
});
