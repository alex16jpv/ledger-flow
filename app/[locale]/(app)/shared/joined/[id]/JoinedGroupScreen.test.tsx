import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import { joinedExpense, joinedGroup, receivedInvitation } from "@/lib/testing/vault";
import type { JoinedExpense, JoinedGroup } from "@/types/api";

import { JoinedGroupScreen } from "./JoinedGroupScreen";

type Share = JoinedExpense["split"]["shares"][number];

const share = (contactId: string | null, amount: number, collected = 0): Share => ({
  party: contactId === null ? "USER" : "CONTACT",
  contactId,
  percent: null,
  fixedAmount: null,
  amount,
  collected,
});

const line = (
  id: string,
  description: string,
  shares: Share[],
  over: Partial<JoinedExpense> = {},
) =>
  joinedExpense({
    id,
    description,
    amount: shares.reduce((sum, s) => sum + s.amount, 0),
    split: { mode: "EQUAL", guests: null, shares },
    ...over,
  });

const lines = [
  line("je1", "Groceries", [share(null, 60_000), share("k2", 60_000, 60_000), share("k3", 60_000)]),
  line("je2", "Dinner", [share(null, 80_000), share("k2", 80_000), share("k3", 80_000)], {
    date: "2026-09-20T15:00:00.000Z",
  }),
  line("je3", "Horse ride", [share(null, 50_000), share("k2", 50_000), share("k3", 50_000)], {
    paidByContactId: "k3",
  }),
];

const page = (data: unknown[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

const fetchMock = vi.fn<typeof fetch>();
const replace = vi.fn();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }),
  usePathname: () => "/shared/joined/g9",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function serve(group: JoinedGroup = joinedGroup()) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.endsWith("/leave") && init?.method === "POST") {
      return Promise.resolve(json(receivedInvitation({ id: "r1", groupId: "g9", status: "LEFT" })));
    }
    if (url.startsWith("/api/joined-groups/g9/expenses")) return Promise.resolve(page(lines));
    if (url.startsWith("/api/joined-groups")) return Promise.resolve(page([group]));
    return Promise.resolve(page([]));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <JoinedGroupScreen id="g9" />
      </ToastProvider>
    </QueryProvider>,
  );

describe("JoinedGroupScreen", () => {
  it("leads with where you stand with the person who shared it, read-only", async () => {
    view();

    expect(await screen.findByText("You owe Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText(/only Ana Ruiz can change it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Settle up/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("$60,000 paid of $140,000 · what you owe Ana Ruiz"),
    ).toBeInTheDocument();
  });

  it("names you as You, and somebody who has not joined by the owner's name for them", async () => {
    view();

    await screen.findByText("You owe Ana Ruiz");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText(/Has not joined · the name Ana Ruiz gave them/)).toBeInTheDocument();
  });

  it("says where each line stands from your side", async () => {
    view();

    const groceries = await screen.findByRole("button", { name: /Groceries/ });
    expect(groceries).toHaveTextContent("ready for your ledger");
    expect(screen.getByText(/yours to add once Ana Ruiz marks it paid/)).toBeInTheDocument();
    expect(screen.getByText(/Carlitos paid · between you and Carlitos/)).toBeInTheDocument();
  });

  it("offers Add to my ledger only for the lines the owner marked paid", async () => {
    const user = userEvent.setup();
    view();

    await user.click(await screen.findByRole("button", { name: "Add to my ledger · 1 ready" }));

    const sheet = await screen.findByRole("dialog", { name: "Add to my ledger" });
    expect(within(sheet).getByText(/Your share of Groceries/)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Add $60,000" })).toBeDisabled();
  });

  it("leaves the group and goes back to Shared", async () => {
    const user = userEvent.setup();
    view();

    await user.click(await screen.findByRole("button", { name: "Leave this group" }));
    const sheet = await screen.findByRole("dialog", { name: /Leave Villa de Leyva weekend/ });
    await user.click(within(sheet).getByRole("button", { name: "Leave" }));

    await vi.waitFor(() => {
      expect(replace).toHaveBeenCalledWith({ pathname: "/shared", query: { face: "groups" } });
    });
    expect(
      fetchMock.mock.calls.some(([input]) => urlOf(input).endsWith("/invitations/r1/leave")),
    ).toBe(true);
  });

  it("says the group is no longer shared when it is not among yours", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(page([])));
    view();

    expect(await screen.findByText("This group is no longer shared with you.")).toBeInTheDocument();
  });
});
