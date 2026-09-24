import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { FormatSettingsProvider } from "@/lib/i18n/FormatSettingsProvider";
import { rememberServerTime, resetClockOffset } from "@/lib/local/clock";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { EditTransactionScreen, NewTransactionScreen } from "./TransactionFormScreen";

const push = vi.fn();
const back = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back, replace }),
  usePathname: () => "/transactions/new",
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const pagination = { limit: 100, offset: 0, total: 2, hasMore: false, nextCursor: null };
const accounts = [
  { id: "a1", name: "Bancolombia", type: "ACCOUNT", balance: 100, isDefault: true, color: "BLUE" },
  { id: "a2", name: "Savings", type: "SAVINGS", balance: 5, isDefault: false, color: "GREEN" },
];
const debtAccounts = [
  ...accounts,
  {
    id: "a3",
    name: "Visa Gold",
    type: "CARD",
    balance: -50,
    isDefault: false,
    color: "PURPLE",
    creditLimit: 400,
  },
  {
    id: "a4",
    name: "Car loan",
    type: "LOAN",
    balance: -800,
    isDefault: false,
    color: "INDIGO",
    borrowedAmount: 1200,
  },
  {
    id: "a5",
    name: "Overdraft",
    type: "OVERDRAFT",
    balance: 32,
    isDefault: false,
    color: "TEAL",
    creditLimit: 200,
  },
];
const categories = [
  { id: "c1", name: "Food", icon: "utensils", color: "ORANGE", type: "EXPENSE", archivedAt: null },
];
const stored = {
  id: "t1",
  type: "EXPENSE",
  amount: 18400,
  date: "2026-08-22T23:10:00.000Z",
  categoryId: "c1",
  description: "Uber to work",
  fromAccountId: "a1",
  toAccountId: null,
  userId: "u1",
  tags: ["work"],
  note: null,
  pendingDetails: false,
  source: "MANUAL",
  currency: "COP",
  createdAt: "",
  updatedAt: "",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch() {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/accounts")) return Promise.resolve(json({ data: accounts, pagination }));
    if (url.includes("/api/categories"))
      return Promise.resolve(json({ data: categories, pagination }));
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
    if (url.endsWith("/api/transactions/tags"))
      return Promise.resolve(json({ data: ["work", "travel"] }));
    if (url.endsWith("/api/transactions") && method === "POST")
      return Promise.resolve(json({ ...stored, id: "t9" }, { status: 201 }));
    if (url.endsWith("/api/transactions/t1") && method === "GET")
      return Promise.resolve(json(stored));
    if (url.endsWith("/api/transactions/t1") && method === "PUT")
      return Promise.resolve(json(stored));
    if (url.endsWith("/api/transactions/t1") && method === "DELETE")
      return Promise.resolve(json({ message: "ok" }));
    return Promise.resolve(
      json({ code: "INTERNAL", message: `${method} ${url}` }, { status: 500 }),
    );
  });
}

// T-93 needs a card and a loan on the list; the default set has neither, and an intent chip test counts on that.
function routeFetchWithDebt() {
  routeFetch();
  const base = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((input, init) => {
    if (urlOf(input).includes("/api/accounts")) {
      return Promise.resolve(json({ data: debtAccounts, pagination }));
    }
    return base?.(input, init) ?? Promise.reject(new Error("no route"));
  });
}

// A transfer keeps three account sheets mounted — From, To and the intent chips — so the open one wins.
async function openAccountSheet() {
  const sheets = await screen.findAllByRole("dialog", { name: "Account" });
  const shown = sheets.find((sheet) => sheet.hasAttribute("open"));
  if (!shown) throw new Error("no account sheet is open");
  return shown;
}

const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  replace.mockReset();
  search = "";
  vi.stubGlobal("fetch", fetchMock);
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetClockOffset();
});

function render(ui: React.ReactElement) {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>{ui}</ToastProvider>
    </QueryProvider>,
  );
}

describe("NewTransactionScreen", () => {
  it("prefills the quick-add draft and posts an expense with tags and the idempotency key", async () => {
    search = "amount=4500&accountId=a1&description=Bus";
    render(<NewTransactionScreen />);
    expect(await screen.findByRole("button", { name: /Account.*Bancolombia/ })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("4,500");
    expect(screen.getByRole("textbox", { name: /^Description/ })).toHaveValue("Bus");
    await userEvent.type(screen.getByRole("textbox", { name: /^Tags/ }), "Travel{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/transactions");
    });
    const [post] = calls("POST");
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      id: expect.stringMatching(UUID),
      type: "EXPENSE",
      amount: 4500,
      fromAccountId: "a1",
      toAccountId: null,
      categoryId: null,
      description: "Bus",
      tags: ["travel"],
      note: null,
    });
    expect(new Headers(post?.[1]?.headers).get("Idempotency-Key")).toBeNull();
    expect(await screen.findByText("Transaction saved")).toBeVisible();
  });

  // T-159: opened cold from the installed app's shortcut, before the profile says where the user is.
  it("waits for the user's zone and currency before it fixes the date and the amount", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T22:30:00.000Z"));
    search = "accountId=a1";
    const screenIn = (profileResolved: boolean) => (
      <QueryProvider>
        <ToastProvider>
          <FormatSettingsProvider
            profileResolved={profileResolved}
            {...(profileResolved ? { timeZone: "Europe/Madrid", currency: "USD" } : {})}
          >
            <NewTransactionScreen />
          </FormatSettingsProvider>
        </ToastProvider>
      </QueryProvider>
    );
    const { rerender } = renderWithProviders(screenIn(false));
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Amount" })).not.toBeInTheDocument();

    rerender(screenIn(true));
    expect(await screen.findByRole("button", { name: /Account.*Bancolombia/ })).toBeVisible();
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "12.5");
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("12.5");
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/transactions");
    });
    const [post] = calls("POST");
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      amount: 12.5,
      date: "2026-09-24T22:30:00.000Z",
    });
  });

  it("keeps the amount when switching to a transfer and refuses the same account twice", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "900");
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("900");
    // T-86: the category stays, optional and filtered to the type.
    expect(screen.getByRole("button", { name: /Category \(optional\)/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(screen.getByRole("option", { name: /Bancolombia/ }));
    await userEvent.click(screen.getByRole("button", { name: /^To/ }));
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).not.toContain(
      expect.stringMatching(/Bancolombia/),
    );
    await userEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: /Savings/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Swap accounts" }));
    expect(screen.getByRole("button", { name: /^From.*Savings/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^To.*Bancolombia/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toMatchObject({
      type: "TRANSFER",
      fromAccountId: "a2",
      toAccountId: "a1",
    });
  });

  // F-66, the preventive half: the form's guard runs on this device's clock, not the server's.
  it("warns when this device's clock runs ahead of the server's", async () => {
    const vault = await openTestVault("u1");
    await rememberServerTime(
      vault.db,
      "2026-09-22T18:12:00.000Z",
      Date.parse("2026-09-25T18:12:00.000Z"),
    );
    render(<NewTransactionScreen />);

    const warning = await screen.findByText(/clock is 3 days ahead of the server/);
    expect(warning).toHaveTextContent("Dates more than 24 hours in the future will be refused.");
    await wipeVaults();
  });

  it("says nothing when the two clocks agree", async () => {
    render(<NewTransactionScreen />);
    expect(await screen.findByRole("button", { name: /^Date/ })).toBeInTheDocument();
    expect(screen.queryByText(/clock is/)).not.toBeInTheDocument();
  });

  it("shows server field errors next to the responsible field", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? json({ code: "FUTURE_DATE", message: "too late" }, { status: 400 })
          : urlOf(input).includes("/api/accounts")
            ? json({ data: accounts, pagination })
            : json({ data: [], pagination }),
      ),
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "10");
    await userEvent.click(screen.getByRole("button", { name: /^Account/ }));
    await userEvent.click(screen.getByRole("option", { name: /Bancolombia/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/future|ahead/i);
    expect(push).not.toHaveBeenCalled();
  });

  // T-85: the fourth type is not a thing that happened to your money, and it left this form.
  it("offers three types and explains the selected one", async () => {
    render(<NewTransactionScreen />);
    const types = await screen.findByRole("group", { name: "Type" });
    expect(
      within(types)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Expense", "Income", "Transfer"]);
    expect(
      screen.getByText("Money leaving one of your accounts and not coming back."),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.getByText("Money arriving into one of your accounts.")).toBeVisible();
  });

  // T-86: the chip fills the direction, which is the only thing people get backwards.
  it("an intent chip fills both sides and the form reads the movement back", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "300000");
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Move to savings" }));

    expect(screen.getByRole("button", { name: /^From.*Bancolombia/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^To.*Savings/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Move to savings" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Bancolombia −$300,000 · Savings +$300,000.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toMatchObject({
      type: "TRANSFER",
      amount: 300000,
      fromAccountId: "a1",
      toAccountId: "a2",
    });
  });

  // A category belongs to one type, so the switch has to put it aside, not throw it away.
  it("gives each type back the category chosen under it", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: /^Category/ }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Category" })).getByRole("option", {
        name: /Food/,
      }),
    );
    expect(screen.getByRole("button", { name: /Category.*Food/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.queryByRole("button", { name: /Category.*Food/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expense" }));
    expect(screen.getByRole("button", { name: /Category.*Food/ })).toBeVisible();
  });

  // T-93: money arriving at a debt account is a payment; the server refuses it as income.
  it("does not offer a debt account for an income, and says why", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    await userEvent.click(screen.getByRole("button", { name: /^Account/ }));

    const sheet = await screen.findByRole("dialog", { name: "Account" });
    expect(within(sheet).getByRole("option", { name: /Bancolombia/ })).toBeVisible();
    expect(within(sheet).queryByRole("option", { name: /Visa Gold/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("option", { name: /Car loan/ })).not.toBeInTheDocument();
    // An overdraft is the account that dips below zero: a salary landing there is income (T-93).
    expect(within(sheet).getByRole("option", { name: /Overdraft/ })).toBeVisible();
    expect(within(sheet).getByText(/is a payment, not income/)).toBeVisible();
  });

  it("drops a card already chosen when the type becomes an income", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: /^Account/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "Account" })).getByRole("option", {
        name: /Visa Gold/,
      }),
    );
    expect(screen.getByRole("button", { name: /Account.*Visa Gold/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.queryByRole("button", { name: /Account.*Visa Gold/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Account/ })).toHaveTextContent("Choose an account");
  });

  // T-93: the server refuses it, and offline the mirror would draw the loan paid until the sync said no.
  it("refuses a transfer that would pay a loan more than it owes", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "900");
    await userEvent.click(await screen.findByRole("button", { name: "Pay a loan" }));

    expect(await screen.findByText(/cannot be paid more than/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    expect(calls("POST")).toHaveLength(0);

    await userEvent.clear(screen.getByRole("textbox", { name: "Amount" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "800");
    expect(screen.queryByText(/cannot be paid more than/)).not.toBeInTheDocument();
  });

  it("offers Somewhere else in the From only when the To owes money", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Move to savings" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));

    const plain = await openAccountSheet();
    expect(within(plain).queryByRole("option", { name: /Somewhere else/ })).not.toBeInTheDocument();
    await userEvent.click(within(plain).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Pay a loan" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    const debt = await openAccountSheet();
    expect(within(debt).getByRole("option", { name: /Somewhere else/ })).toBeVisible();
    expect(within(debt).getByText(/is not an account and creates nothing/)).toBeVisible();
  });

  it("does not offer it towards a debt account that owes nothing", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).includes("/api/accounts")) {
        return Promise.resolve(
          json({
            data: [
              ...accounts,
              { ...debtAccounts[2], balance: 120 },
              { ...debtAccounts[3], balance: 0 },
            ],
            pagination,
          }),
        );
      }
      return Promise.resolve(json({ code: "INTERNAL", message: urlOf(input) }, { status: 500 }));
    });
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));

    for (const chip of ["Pay a card", "Pay a loan"]) {
      await userEvent.click(await screen.findByRole("button", { name: chip }));
      await userEvent.click(screen.getByRole("button", { name: /^From/ }));
      const sheet = await openAccountSheet();
      expect(
        within(sheet).queryByRole("option", { name: /Somewhere else/ }),
      ).not.toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    }
  });

  // The overdraft takes income and still owes money below zero: both records exist because both acts do.
  it("offers it towards an overdraft in the red", async () => {
    fetchMock.mockImplementation((input) => {
      if (urlOf(input).includes("/api/accounts")) {
        return Promise.resolve(
          json({ data: [...accounts, { ...debtAccounts[4], balance: -90 }], pagination }),
        );
      }
      return Promise.resolve(json({ code: "INTERNAL", message: urlOf(input) }, { status: 500 }));
    });
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Pay a card" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));

    expect(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    ).toBeVisible();
  });

  it("writes a debt paid from outside as a one-sided adjustment", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "30");
    await userEvent.click(await screen.findByRole("button", { name: "Pay a loan" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    );

    expect(screen.getByRole("button", { name: /From.*Somewhere else/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Swap accounts" })).toBeDisabled();
    expect(screen.queryByText(/marked as Transfer are offered here/)).not.toBeInTheDocument();
    expect(screen.getByText(/never was in Ledger Flow/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toMatchObject({
      type: "ADJUSTMENT",
      amount: 30,
      fromAccountId: null,
      toAccountId: "a4",
      categoryId: null,
      description: "Paid from outside Ledger Flow",
    });
  });

  it("keeps the description the user typed instead of the one it writes for them", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "30");
    await userEvent.click(await screen.findByRole("button", { name: "Pay a loan" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: /^Description/ }),
      "My mother paid it",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toMatchObject({
      type: "ADJUSTMENT",
      description: "My mother paid it",
    });
  });

  it("takes the row away, and the choice with it, when the To stops owing money", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "30");
    await userEvent.click(await screen.findByRole("button", { name: "Pay a loan" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    );
    expect(screen.getByRole("button", { name: /From.*Somewhere else/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /^To/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Savings/ }),
    );

    expect(screen.getByRole("button", { name: /^From/ })).toHaveTextContent("Choose an account");
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));
    expect(calls("POST")).toHaveLength(0);
    expect(await screen.findByText("This field is required.")).toBeVisible();
  });

  it("drops the choice when the type leaves the transfer and comes back", async () => {
    routeFetchWithDebt();
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Pay a loan" }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    );
    expect(screen.getByRole("button", { name: /From.*Somewhere else/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Expense" }));
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(screen.queryByRole("button", { name: /From.*Somewhere else/ })).not.toBeInTheDocument();
  });

  it("offers no intent chip for a kind of account nobody has", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(await screen.findByRole("button", { name: "Move to savings" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pay a card" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay a loan" })).not.toBeInTheDocument();
  });
});

describe("EditTransactionScreen", () => {
  it("loads the transaction, saves changes with a PUT and deletes after confirming", async () => {
    render(<EditTransactionScreen id="t1" />);
    expect(await screen.findByRole("textbox", { name: /^Description/ })).toHaveValue(
      "Uber to work",
    );
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("18,400");
    expect(screen.getByRole("button", { name: "Remove tag work" })).toBeVisible();
    expect(await screen.findByRole("button", { name: /Category.*Food/ })).toBeVisible();
    expect(await screen.findByRole("button", { name: /Account.*Bancolombia/ })).toBeVisible();

    await userEvent.clear(screen.getByRole("textbox", { name: /^Description/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Description/ }), "Taxi");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(calls("PUT")).toHaveLength(1);
    });
    // §1 example 3: only what was touched travels, or every disagreement becomes a money conflict.
    expect(JSON.parse(calls("PUT")[0]?.[1]?.body as string)).toEqual({ description: "Taxi" });
    expect(push).toHaveBeenCalledWith("/transactions");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this transaction?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(calls("DELETE")).toHaveLength(1);
    });
    expect(await screen.findByText("Transaction deleted")).toBeVisible();
  });

  // P-17: a quick capture edited through the full form with a category is no longer To review.
  it("completes a quick capture when the full form saves it with a category", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/transactions/t1") && method === "GET")
        return Promise.resolve(json({ ...stored, pendingDetails: true, source: "QUICK" }));
      if (url.endsWith("/api/transactions/t1") && method === "PUT")
        return Promise.resolve(json(stored));
      if (url.includes("/api/accounts"))
        return Promise.resolve(json({ data: accounts, pagination }));
      if (url.includes("/api/categories"))
        return Promise.resolve(json({ data: categories, pagination }));
      if (url.includes("/api/stats/spending"))
        return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
      if (url.endsWith("/api/transactions/tags")) return Promise.resolve(json({ data: ["work"] }));
      return Promise.resolve(json({ code: "INTERNAL", message: url }, { status: 500 }));
    });
    render(<EditTransactionScreen id="t1" />);
    expect(await screen.findByRole("textbox", { name: /^Description/ })).toHaveValue(
      "Uber to work",
    );
    await userEvent.clear(screen.getByRole("textbox", { name: /^Description/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Description/ }), "Latte");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(calls("PUT")).toHaveLength(1);
    });
    expect(JSON.parse(calls("PUT")[0]?.[1]?.body as string)).toEqual({
      description: "Latte",
      pendingDetails: false,
    });
  });

  // R-5 §A: the API refuses an empty PUT, and offline it would sit in the attention tray.
  it("waits for the user's zone before it reads the stored date into the form", async () => {
    const screenIn = (profileResolved: boolean) => (
      <QueryProvider>
        <ToastProvider>
          <FormatSettingsProvider profileResolved={profileResolved}>
            <EditTransactionScreen id="t1" />
          </FormatSettingsProvider>
        </ToastProvider>
      </QueryProvider>
    );
    const { rerender } = renderWithProviders(screenIn(false));
    await waitFor(() => {
      expect(calls("GET").some(([input]) => urlOf(input).endsWith("/api/transactions/t1"))).toBe(
        true,
      );
    });
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /^Description/ })).not.toBeInTheDocument();

    rerender(screenIn(true));
    expect(await screen.findByRole("textbox", { name: /^Description/ })).toHaveValue(
      "Uber to work",
    );
  });

  it("saving an untouched edit sends nothing and leaves the form", async () => {
    render(<EditTransactionScreen id="t1" />);
    expect(await screen.findByRole("textbox", { name: /^Description/ })).toHaveValue(
      "Uber to work",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/transactions");
    });
    expect(calls("PUT")).toHaveLength(0);
  });

  // T-85: an adjustment is edited in the account's own sheet, so this route hands it back.
  it("sends an adjustment back to its detail screen instead of showing this form", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith("/api/transactions/t1") && (init?.method ?? "GET") === "GET")
        return Promise.resolve(json({ ...stored, type: "ADJUSTMENT", categoryId: null }));
      if (url.includes("/api/accounts"))
        return Promise.resolve(json({ data: accounts, pagination }));
      return Promise.resolve(json({ data: [], pagination }));
    });
    render(<EditTransactionScreen id="t1" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/transactions/t1");
    });
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
  });

  // A converted movement carries no category, so the inbox rule has to let an adjustment complete one.
  it("turns a transfer waiting to be detailed into a payment from outside, and clears the review flag", async () => {
    const transfer = {
      ...stored,
      type: "TRANSFER",
      categoryId: null,
      fromAccountId: "a1",
      toAccountId: "a3",
      pendingDetails: true,
    };
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/accounts"))
        return Promise.resolve(json({ data: debtAccounts, pagination }));
      if (url.includes("/api/categories"))
        return Promise.resolve(json({ data: categories, pagination }));
      if (url.includes("/api/stats/spending"))
        return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
      if (url.endsWith("/api/transactions/tags")) return Promise.resolve(json({ data: [] }));
      if (url.endsWith("/api/transactions/t1") && method === "GET")
        return Promise.resolve(json(transfer));
      if (url.endsWith("/api/transactions/t1") && method === "PUT")
        return Promise.resolve(json(transfer));
      return Promise.resolve(
        json({ code: "INTERNAL", message: `${method} ${url}` }, { status: 500 }),
      );
    });
    render(<EditTransactionScreen id="t1" />);
    expect(await screen.findByRole("button", { name: /From.*Bancolombia/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openAccountSheet()).getByRole("option", { name: /Somewhere else/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(calls("PUT")).toHaveLength(1);
    });
    expect(JSON.parse(calls("PUT")[0]?.[1]?.body as string)).toMatchObject({
      type: "ADJUSTMENT",
      fromAccountId: null,
      toAccountId: "a3",
      categoryId: null,
      pendingDetails: false,
    });
  });

  it("shows the not-found state for a missing id", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ code: "NOT_FOUND", message: "missing" }, { status: 404 })),
    );
    render(<EditTransactionScreen id="nope" />);
    expect(
      await screen.findByRole("heading", {
        name: "This transaction doesn’t exist or was deleted.",
      }),
    ).toBeVisible();
  });
});
