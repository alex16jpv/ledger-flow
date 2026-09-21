import { screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import type { SettleParty } from "@/features/shared/settle";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";

import { SettleUpSheet } from "./SettleUpSheet";

const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared",
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

const line = (over: Partial<SettleParty["theyOwe"][number]> = {}) => ({
  expenseId: "s1",
  groupId: "g1",
  groupName: "Night out",
  description: "Food",
  date: "2026-08-10T20:00:00.000Z",
  amount: 60_000,
  ...over,
});

const party = (over: Partial<SettleParty> = {}): SettleParty => ({
  key: "contact:k1",
  contactId: "k1",
  expenseId: null,
  name: "Ana Ruiz",
  color: null,
  owedToYou: 60_000,
  youOwe: 0,
  net: 60_000,
  surplus: 0,
  theyOwe: [line()],
  yourLines: [],
  groups: [{ id: "g1", name: "Night out" }],
  ...over,
});

const open = (one: SettleParty) => {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SettleUpSheet open party={one} onClose={vi.fn()} />
      </ToastProvider>
    </QueryProvider>,
  );
};

describe("the settle-up sheet", () => {
  it("leads with what is open and says the money coming back is not income", () => {
    open(party());

    expect(screen.getByRole("dialog", { name: /Settle up with Ana Ruiz/ })).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz owes you")).toBeInTheDocument();
    expect(screen.getByText("This is not income.")).toBeInTheDocument();
    expect(screen.getByText(/It covers, oldest expense first/)).toBeInTheDocument();
  });

  it("names the net she sends when the two of you owe each other", () => {
    open(
      party({
        youOwe: 30_000,
        net: 30_000,
        yourLines: [line({ expenseId: "s3", description: "Tickets", amount: 30_000 })],
      }),
    );

    expect(screen.getByText("Ana Ruiz sends you")).toBeInTheDocument();
    expect(screen.getByText("This records two things.")).toBeInTheDocument();
    // The category is yours to choose: the shared layer carries none.
    expect(screen.getByText(/Category for your .* of Tickets/)).toBeInTheDocument();
  });

  it("asks to pay, not to record, when you are the one who owes", () => {
    open(
      party({
        owedToYou: 0,
        youOwe: 60_000,
        net: -60_000,
        theyOwe: [],
        yourLines: [line({ expenseId: "s3", description: "Tickets", amount: 60_000 })],
      }),
    );

    expect(screen.getByRole("dialog", { name: /Pay Ana Ruiz/ })).toBeInTheDocument();
    expect(screen.getByText("This one is an expense of yours.")).toBeInTheDocument();
  });
});
