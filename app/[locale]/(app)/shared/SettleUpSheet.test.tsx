import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import type { SettleParty } from "@/features/shared/settle";
import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { json, urlOf } from "@/lib/testing/http";
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
  vi.useRealTimers();
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
  scope: null,
  ...over,
});

// Beto owes you 500,000 in the trip and 26,300 more in Night out, which is older.
const fromTheTrip = (over: Partial<SettleParty> = {}): SettleParty =>
  party({
    key: "contact:k2",
    contactId: "k2",
    name: "Beto",
    owedToYou: 526_300,
    net: 526_300,
    theyOwe: [
      line({ expenseId: "n1", description: "Drinks", amount: 26_300 }),
      line({
        expenseId: "t1",
        groupId: "g2",
        groupName: "Cartagena trip",
        description: "Hotel",
        date: "2026-08-30T20:00:00.000Z",
        amount: 500_000,
      }),
    ],
    groups: [
      { id: "g1", name: "Night out" },
      { id: "g2", name: "Cartagena trip" },
    ],
    scope: {
      groupId: "g2",
      groupName: "Cartagena trip",
      owedToYou: 500_000,
      youOwe: 0,
      net: 500_000,
    },
    ...over,
  });

const amountField = () => screen.getByRole("textbox", { name: "Amount" });

function posted(): unknown {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => urlOf(input).startsWith("/api/settlements") && init?.method === "POST",
  );
  return call ? (JSON.parse(call[1]?.body as string) as unknown) : undefined;
}

const open = (one: SettleParty, onWriteOff?: () => void) => {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <SettleUpSheet open party={one} onClose={vi.fn()} onWriteOff={onWriteOff} />
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

  it("opened from a group, proposes that group and states the total across every group", () => {
    open(fromTheTrip());

    expect(screen.getByText("Beto owes you in Cartagena trip")).toBeInTheDocument();
    expect(screen.getByText("Across every group, Beto owes you").parentElement).toHaveTextContent(
      "526,300",
    );
    expect(amountField()).toHaveValue("500,000");
    expect(
      screen.getByText(
        "It settles Cartagena trip. Send less and it stays in this group; send more and the rest covers what Beto owes you elsewhere, oldest expense first.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("It covers Cartagena trip first, oldest expense first:"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cartagena trip · Hotel/)).toBeInTheDocument();
    expect(screen.queryByText(/Night out · Drinks/)).not.toBeInTheDocument();
  });

  // What the group's write-off gives up is that group's figure, never the total.
  it("offers to write off what is open in the group", () => {
    open(fromTheTrip(), vi.fn());

    expect(screen.getByRole("button", { name: "Write off $500,000" })).toBeInTheDocument();
  });

  it("takes more than the group, up to the total, and says where the rest goes", async () => {
    open(fromTheTrip());

    await userEvent.clear(amountField());
    await userEvent.type(amountField(), "510000");
    expect(
      screen.getByText(
        "It covers Cartagena trip first, and the rest goes to what Beto owes you elsewhere, oldest expense first:",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Night out · Drinks/)).toBeInTheDocument();
    expect(screen.queryByText(/It settles Cartagena trip/)).not.toBeInTheDocument();

    await userEvent.clear(amountField());
    await userEvent.type(amountField(), "526301");
    expect(
      screen.getByText("That is more than the $526,300 open between you."),
    ).toBeInTheDocument();
  });

  it("keeps the group's direction and caps at the group when the total points the other way", async () => {
    open(fromTheTrip({ owedToYou: 500_000, youOwe: 700_000, net: -200_000 }));

    expect(screen.getByRole("dialog", { name: /Settle up with Beto/ })).toBeInTheDocument();
    expect(screen.getByText("Across every group, you owe Beto")).toBeInTheDocument();
    expect(
      screen.getByText("It settles Cartagena trip. Send less and it stays in this group."),
    ).toBeInTheDocument();
    await userEvent.type(amountField(), "1");
    expect(
      screen.getByText("That is more than the $500,000 open in Cartagena trip."),
    ).toBeInTheDocument();
  });

  it("asks to pay the group back when you owe there, and says where more would go", () => {
    open(
      fromTheTrip({
        owedToYou: 0,
        youOwe: 100_000,
        net: -100_000,
        theyOwe: [],
        yourLines: [
          line({ expenseId: "t3", groupId: "g2", groupName: "Cartagena trip", amount: 60_000 }),
          line({ expenseId: "n3", description: "Tickets", amount: 40_000 }),
        ],
        scope: {
          groupId: "g2",
          groupName: "Cartagena trip",
          owedToYou: 0,
          youOwe: 60_000,
          net: -60_000,
        },
      }),
    );

    expect(screen.getByRole("dialog", { name: /Pay Beto/ })).toBeInTheDocument();
    expect(screen.getByText("You owe Beto in Cartagena trip")).toBeInTheDocument();
    expect(screen.getByText("Across every group, you owe Beto")).toBeInTheDocument();
    expect(amountField()).toHaveValue("60,000");
    expect(
      screen.getByText(
        "It settles Cartagena trip. Send less and it stays in this group; send more and the rest covers what you owe Beto elsewhere, oldest expense first.",
      ),
    ).toBeInTheDocument();
  });

  it("says the two of you are even across every group when the total is zero", () => {
    open(fromTheTrip({ owedToYou: 500_000, youOwe: 500_000, net: 0 }));

    expect(screen.getByText("Across every group, you are even")).toBeInTheDocument();
  });

  it("sends the group it was opened from with the payment", async () => {
    open(fromTheTrip());

    await userEvent.click(screen.getByRole("button", { name: /Where it arrives/ }));
    await userEvent.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: /Nowhere here/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() => {
      expect(posted()).toMatchObject({ contactId: "k2", groupId: "g2", collected: 500_000 });
    });
  });

  it("sends no group from a person's own sheet", async () => {
    open(party());

    await userEvent.click(screen.getByRole("button", { name: /Where it arrives/ }));
    await userEvent.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: /Nowhere here/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() => {
      expect(posted()).toMatchObject({ contactId: "k1", collected: 60_000 });
    });
    expect(posted()).not.toHaveProperty("groupId");
  });

  // T-159: a sheet drawn before the profile arrived takes the user's day once it does.
  it("keeps today as the day when the profile moves it to another zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T22:30:00.000Z"));
    const sheet = (timeZone?: string) => (
      <QueryProvider>
        <ToastProvider>
          <FormatSettingsProvider {...(timeZone ? { timeZone } : {})}>
            <SettleUpSheet open party={party()} onClose={vi.fn()} />
          </FormatSettingsProvider>
        </ToastProvider>
      </QueryProvider>
    );
    const { rerender } = renderWithProviders(sheet());
    rerender(sheet("Europe/Madrid"));

    expect(screen.getByRole("button", { name: /^Date/ })).toHaveTextContent(/Today/);
  });
});
