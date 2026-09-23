import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { sectionOf } from "../ledger";
import { AddPeopleSheet } from "./AddPeopleSheet";

const ANA = "k1";
const DIEGO = "k3";
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/shared",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const contacts = [
  contact({ id: ANA, name: "Ana Ruiz" }),
  contact({ id: DIEGO, name: "Diego Pardo" }),
];

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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (url.includes("/participants/preview")) {
      return Promise.resolve(
        json({
          participants: [
            { contactId: null, shareBefore: 50_000, shareAfter: 33_300 },
            { contactId: ANA, shareBefore: 50_000, shareAfter: 33_300 },
            { contactId: DIEGO, shareBefore: 0, shareAfter: 33_400 },
          ],
          expenses: { total: 1, resplit: 1, untouched: 0 },
        }),
      );
    }
    return Promise.resolve(
      json({
        data: contacts,
        pagination: { limit: 20, offset: 0, total: 2, hasMore: false, nextCursor: null },
      }),
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open() {
  const section = sectionOf(
    {
      groups: [
        withTotals(
          sharedGroup({
            id: "g1",
            name: "Night out",
            participants: [null, ANA].map((contactId) => ({
              contactId,
              addedAt: "2026-08-01T00:00:00.000Z",
            })),
          }),
        ),
      ],
      expenses: [
        sharedExpense({
          id: "s1",
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
      ],
      settlements: [],
      undone: [],
    },
    contacts,
  );
  const [view] = section.groups;
  if (!view) throw new Error("no group");
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <AddPeopleSheet open view={view} onClose={vi.fn()} />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("adding people to a group that exists", () => {
  it("reads somebody already in the group instead of offering to pick them", async () => {
    open();

    expect(await screen.findByText("Already in")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Ana Ruiz/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 0" })).toBeDisabled();
  });

  // Off is the default: they are in what you add from now on and in none of what is there.
  it("asks nothing of the server until the switch says to", async () => {
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: /Diego Pardo/ }));
    expect(screen.getByRole("button", { name: "Add Diego Pardo" })).toBeEnabled();
    expect(fetchMock.mock.calls.some(([url]) => urlOf(url ?? "").includes("preview"))).toBe(false);
  });

  it("shows the whole result before it happens once it is asked", async () => {
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: /Diego Pardo/ }));
    await user.click(screen.getByRole("switch"));

    expect(await screen.findByText(/Your share would be/)).toBeInTheDocument();
    expect(screen.getByText(/What counts as yours does not move/)).toBeInTheDocument();
  });
});
