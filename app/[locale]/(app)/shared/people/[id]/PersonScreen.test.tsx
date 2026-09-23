import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { resetOutboxStatus } from "@/lib/local/outbox";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
import { renderWithProviders } from "@/lib/testing/render";
import {
  contact,
  queueWrite,
  settlement,
  sharedExpense,
  sharedGroup,
  wipeVaults,
} from "@/lib/testing/vault";
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

afterEach(async () => {
  vi.unstubAllGlobals();
  resetOutboxStatus();
  await wipeVaults();
});

const view = () =>
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PersonScreen id={ANA} />
      </ToastProvider>
    </QueryProvider>,
  );

describe("PersonScreen", () => {
  // T-140: a payment recorded with no network is the row that waits, and it moves their figures.
  it("marks a payment still on this device, and every figure of theirs it moves", async () => {
    await queueWrite({ entity: "settlement", entityId: "p1" });
    view();

    const row = await screen.findByRole("button", { name: /Paid you \$20,000/ });
    expect(row).toHaveTextContent("Pending sync");
    expect(row).toHaveTextContent("Saved on this device");
    // Their net on top and their figure in the one group they share.
    expect(screen.getAllByRole("img", { name: "Includes changes not yet synced" })).toHaveLength(2);
  });

  it("says what is open with them, what they have paid, and that they are not an account", async () => {
    view();

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    const group = await screen.findByRole("link", { name: /Night out/ });
    expect(screen.getByText(/owes you, across/)).toBeInTheDocument();
    expect(group).toHaveTextContent("Paid $20,000 of");
    expect(screen.getByText("Paid you $20,000")).toBeInTheDocument();
    expect(screen.getByText(/A person is not an account/)).toBeInTheDocument();
  });

  it("says an undo the server refused needs attention, on the payment it would have undone", async () => {
    await queueWrite({ entity: "settlement", entityId: "p1", action: "delete", status: "failed" });
    view();

    const row = await screen.findByRole("button", { name: /Paid you \$20,000/ });
    expect(row).toHaveTextContent("Needs attention");
    expect(row).not.toHaveTextContent("Pending sync");
  });

  // The one thing that can be done to a payment, and the only door to the movement it wrote (T-138).
  it("undoes a payment from its row, saying what goes with it", async () => {
    view();

    await userEvent.click(await screen.findByRole("button", { name: /Paid you \$20,000/ }));
    const sheet = screen.getByRole("dialog", { name: "Undo this payment?" });
    expect(sheet).toHaveTextContent("The $20,000 they paid you goes back to being owed");
    expect(sheet).toHaveTextContent("The movement it wrote goes with it");
    expect(sheet).toHaveTextContent("what was written off stays written off");

    await userEvent.click(screen.getByRole("button", { name: "Undo the payment" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) =>
            (init?.method ?? "GET") === "DELETE" && urlOf(input).endsWith("/api/settlements/p1"),
        ),
      ).toHaveLength(1);
    });
    expect(await screen.findByText("Payment undone")).toBeInTheDocument();
  });

  // One payment settles both directions, so the row names the net and the sheet names both halves.
  it("names the net on the row and both halves in the sheet when it went both ways", async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.startsWith("/api/contacts/")) return Promise.resolve(json(ana));
      if (url.startsWith("/api/contacts")) return Promise.resolve(page([ana]));
      if (url.includes("/expenses")) return Promise.resolve(page(expenses));
      if (url.startsWith("/api/settlements"))
        return Promise.resolve(page([{ ...paid, collected: 60_000, paid: 30_000 }]));
      return Promise.resolve(page([group]));
    });
    view();

    await userEvent.click(await screen.findByRole("button", { name: /Paid you \$30,000/ }));
    const sheet = screen.getByRole("dialog", { name: "Undo this payment?" });
    expect(sheet).toHaveTextContent(
      "The $60,000 they paid you and the $30,000 you handed over both go back to being owed",
    );
    expect(sheet).not.toHaveTextContent("Undo the $60,000");
  });

  it("says what went wrong and keeps the payment when the server refuses the undo", async () => {
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) =>
      (init?.method ?? "GET") === "DELETE"
        ? Promise.resolve(json({ code: "INTERNAL", message: "no" }, { status: 500 }))
        : (base?.(input, init) ?? Promise.reject(new Error("no route"))),
    );
    view();

    await userEvent.click(await screen.findByRole("button", { name: /Paid you \$20,000/ }));
    await userEvent.click(screen.getByRole("button", { name: "Undo the payment" }));

    expect(await screen.findByText(/went wrong|try again|Something/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paid you \$20,000/ })).toBeInTheDocument();
  });

  it("says a payment made in cash moved no balance, because it wrote no movement", async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.startsWith("/api/contacts/")) return Promise.resolve(json(ana));
      if (url.startsWith("/api/contacts")) return Promise.resolve(page([ana]));
      if (url.includes("/expenses")) return Promise.resolve(page(expenses));
      if (url.startsWith("/api/settlements"))
        return Promise.resolve(page([{ ...paid, outsideApp: true }]));
      return Promise.resolve(page([group]));
    });
    view();

    await userEvent.click(await screen.findByRole("button", { name: /Paid you \$20,000/ }));
    const sheet = screen.getByRole("dialog", { name: "Undo this payment?" });
    expect(sheet).toHaveTextContent("it wrote no movement and no balance moves");
    expect(sheet).not.toHaveTextContent("The movement it wrote goes with it");
  });

  // The figure is the ledger's: a screen that draws $0 while it is coming is a screen that lies.
  it("never draws a figure before the ledger answers, and says so when it fails", async () => {
    fetchMock.mockImplementation((input) =>
      urlOf(input).startsWith("/api/contacts/")
        ? Promise.resolve(json(ana))
        : Promise.reject(new TypeError("offline")),
    );
    view();

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/owes you, across/)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
