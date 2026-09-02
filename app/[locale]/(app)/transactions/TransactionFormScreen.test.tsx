import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { EditTransactionScreen, NewTransactionScreen } from "./TransactionFormScreen";

const push = vi.fn();
const back = vi.fn();
let search = "";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back, replace: vi.fn() }),
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

const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  search = "";
  vi.stubGlobal("fetch", fetchMock);
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("4500");
    expect(screen.getByRole("textbox", { name: /^Description/ })).toHaveValue("Bus");
    await userEvent.type(screen.getByRole("textbox", { name: /^Tags/ }), "Travel{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/transactions");
    });
    const [post] = calls("POST");
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      type: "EXPENSE",
      amount: 4500,
      fromAccountId: "a1",
      toAccountId: null,
      categoryId: null,
      description: "Bus",
      tags: ["travel"],
      note: null,
    });
    expect(new Headers(post?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Transaction saved")).toBeVisible();
  });

  it("keeps the amount when switching to a transfer and refuses the same account twice", async () => {
    render(<NewTransactionScreen />);
    await screen.findByRole("group", { name: "Type" });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "900");
    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("900");
    expect(screen.queryByRole("button", { name: /Category/ })).not.toBeInTheDocument();

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
});

describe("EditTransactionScreen", () => {
  it("loads the transaction, saves changes with a PUT and deletes after confirming", async () => {
    render(<EditTransactionScreen id="t1" />);
    expect(await screen.findByRole("textbox", { name: /^Description/ })).toHaveValue(
      "Uber to work",
    );
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("18400");
    expect(screen.getByRole("button", { name: "Remove tag work" })).toBeVisible();
    expect(await screen.findByRole("button", { name: /Category.*Food/ })).toBeVisible();
    expect(await screen.findByRole("button", { name: /Account.*Bancolombia/ })).toBeVisible();

    await userEvent.clear(screen.getByRole("textbox", { name: /^Description/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /^Description/ }), "Taxi");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(calls("PUT")).toHaveLength(1);
    });
    expect(JSON.parse(calls("PUT")[0]?.[1]?.body as string)).toMatchObject({
      description: "Taxi",
      categoryId: "c1",
      fromAccountId: "a1",
      toAccountId: null,
    });
    expect(push).toHaveBeenCalledWith("/transactions");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this transaction?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(calls("DELETE")).toHaveLength(1);
    });
    expect(await screen.findByText("Transaction deleted")).toBeVisible();
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
