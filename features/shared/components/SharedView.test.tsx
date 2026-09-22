import { screen, within } from "@testing-library/react";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { contact, receivedInvitation, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { SharedView } from "./SharedView";

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

const withTotals = (
  row: SyncSharedGroup,
  totals: Partial<SharedGroup["totals"]> = {},
): SharedGroup => ({
  ...row,
  status: "OPEN",
  totals: {
    amount: 120_000,
    yourShare: 40_000,
    owedToYou: 80_000,
    writtenOff: 0,
    youOwe: 0,
    collected: 0,
    expenseCount: 1,
    dateFrom: "2026-08-10T20:00:00.000Z",
    dateTo: "2026-08-10T20:00:00.000Z",
    ...totals,
  },
});

const nightOut = withTotals(sharedGroup({ id: "g1", name: "Night out" }));
const groups = [nightOut];
const expenses = [
  sharedExpense({
    id: "s1",
    description: "Food",
    amount: 120_000,
    split: {
      mode: "EQUAL",
      guests: null,
      shares: [
        share({ party: "USER", contactId: null, amount: 40_000 }),
        share({ contactId: ANA, amount: 40_000 }),
        share({ contactId: BETO, amount: 40_000 }),
      ],
    },
  }),
];
const contacts = [contact({ id: ANA, name: "Ana Ruiz" }), contact({ id: BETO, name: "Beto Cano" })];

const fetchMock = vi.fn<typeof fetch>();

function serve(
  rows: {
    groups?: unknown[];
    expenses?: unknown[];
    settlements?: unknown[];
    contacts?: unknown[];
    invitations?: unknown[];
  } = {},
) {
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (url.startsWith("/api/contacts")) return Promise.resolve(page(rows.contacts ?? contacts));
    if (url.includes("/expenses")) return Promise.resolve(page(rows.expenses ?? expenses));
    if (url.startsWith("/api/settlements")) return Promise.resolve(page(rows.settlements ?? []));
    if (url.startsWith("/api/invitations")) return Promise.resolve(page(rows.invitations ?? []));
    return Promise.resolve(page(rows.groups ?? groups));
  });
}

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SharedView />
      </ToastProvider>
    </QueryProvider>,
  );

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }),
  usePathname: () => "/shared",
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string | { pathname: string; query?: Record<string, string> };
    className?: string;
  }) => (
    <a
      className={className}
      href={
        typeof href === "string"
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`
      }
    >
      {children}
    </a>
  ),
}));

beforeEach(() => {
  search = "";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SharedView", () => {
  it("opens on the people, with the direction said in a word and never in a colour", async () => {
    serve();
    view();

    const row = await screen.findByRole("link", { name: /Ana Ruiz/ });
    expect(row).toHaveTextContent("40,000");
    expect(row).toHaveTextContent("owes you");
    // Both figures of the card, and no net between them (T-85).
    const summary = screen.getByText("Owed to you").closest("div")?.parentElement;
    expect(summary).toHaveTextContent("80,000");
  });

  it("shows the groups with what has come back of what is owed to you", async () => {
    serve();
    search = "face=groups";
    view();

    const row = await screen.findByRole("link", { name: /Night out/ });
    expect(row).toHaveTextContent("Your share $40,000");
    expect(within(row).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  // The server answers SETTLED for a group with nothing in it, which is not a group to fold away.
  it("keeps a group you have just made on the open list", async () => {
    serve({
      groups: [
        {
          ...nightOut,
          status: "SETTLED",
          totals: { ...nightOut.totals, amount: 0, expenseCount: 0, owedToYou: 0 },
        },
      ],
      expenses: [],
    });
    search = "face=groups";
    view();

    expect(await screen.findByRole("link", { name: /Night out/ })).toBeInTheDocument();
  });

  it("says there is nothing yet rather than drawing two empty faces", async () => {
    serve({ groups: [], contacts: [] });
    view();

    expect(await screen.findByText("Nothing shared yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Shared groups/ })).not.toBeInTheDocument();
  });

  // A person you add before any group is still a person: the face is where they are read.
  it("lists somebody you keep even before you have split anything with them", async () => {
    serve({ groups: [], expenses: [] });
    view();

    await screen.findByRole("button", { name: /Settled/ });
    expect(screen.queryByText("Nothing shared yet")).not.toBeInTheDocument();
  });

  it("offers to try again when the section cannot be read", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    view();

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("puts an invitation above everything, the empty state included", async () => {
    serve({ groups: [], contacts: [], invitations: [receivedInvitation()] });
    view();

    const invitations = await screen.findByRole("region", { name: "Invitations" });
    const empty = await screen.findByText("Nothing shared yet");
    expect(invitations.compareDocumentPosition(empty)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
