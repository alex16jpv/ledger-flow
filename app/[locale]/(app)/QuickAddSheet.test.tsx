import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { QuickAddSheet } from "./QuickAddSheet";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const pagination = { limit: 100, offset: 0, total: 1, hasMore: false, nextCursor: null };
const category = (id: string, name: string) => ({
  id,
  name,
  icon: "coffee",
  color: "BROWN",
  type: "EXPENSE",
  userId: "u1",
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
});

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch({ accounts = true } = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/accounts"))
      return Promise.resolve(
        json({
          data: accounts
            ? [
                {
                  id: "a1",
                  name: "Bancolombia",
                  type: "ACCOUNT",
                  balance: 100,
                  isDefault: true,
                  color: "BLUE",
                },
                {
                  id: "a2",
                  name: "Cash",
                  type: "CASH",
                  balance: 5,
                  isDefault: false,
                  color: "GRAY",
                },
              ]
            : [],
          pagination,
        }),
      );
    if (url.includes("/api/categories"))
      return Promise.resolve(
        json({ data: [category("c1", "Coffee"), category("c2", "Food")], pagination }),
      );
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(
        json({
          groupBy: "category",
          total: 0,
          buckets: [{ key: "c1", total: 1, count: 3, avg: 1 }],
        }),
      );
    if (url.endsWith("/api/transactions/quick") && method === "POST")
      return Promise.resolve(json({ id: "t1", pendingDetails: true }, { status: 201 }));
    if (url.endsWith("/api/transactions/t1") && method === "PUT")
      return Promise.resolve(json({ id: "t1", pendingDetails: false }));
    if (url.endsWith("/api/transactions/t1") && method === "DELETE")
      return Promise.resolve(json({ message: "ok" }));
    return Promise.resolve(json({ code: "INTERNAL", message: "unexpected" }, { status: 500 }));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSheet(props: Partial<React.ComponentProps<typeof QuickAddSheet>> = {}) {
  const onClose = vi.fn();
  const onMoreDetails = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <QuickAddSheet
          open
          chain={false}
          onClose={onClose}
          onMoreDetails={onMoreDetails}
          {...props}
        />
      </ToastProvider>
    </QueryProvider>,
  );
  return { onClose, onMoreDetails };
}

const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

describe("QuickAddSheet", () => {
  it("saves in two interactions against the main account, adds the note and offers undo", async () => {
    routeFetch();
    const { onClose } = renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });
    await userEvent.click(
      within(screen.getByRole("group", { name: "Category" })).getByRole("button", {
        name: "Coffee",
      }),
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "12500");
    await userEvent.type(screen.getByRole("textbox", { name: "Quick note (optional)" }), "Latte");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const [post] = calls("POST");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      amount: 12500,
      categoryId: "c1",
      fromAccountId: "a1",
    });
    expect(new Headers(post?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(calls("PUT")[0]?.[1]?.body as string)).toEqual({
      description: "Latte",
      pendingDetails: false,
    });

    const toast = await screen.findByText("Transaction saved");
    expect(toast).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(calls("DELETE")).toHaveLength(1);
    });
    expect(await screen.findByText("Transaction removed")).toBeVisible();
  });

  it("refuses an empty or zero amount before calling the API", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("group", { name: "Category" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid amount.");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(calls("POST")).toHaveLength(0);
  });

  it("keeps the sheet open for the next entry when chained and hands the draft to the full form", async () => {
    routeFetch();
    const { onClose, onMoreDetails } = renderSheet({ chain: true });
    await screen.findByRole("group", { name: "Category" });
    const amount = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.type(amount, "900");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Transaction saved");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("");

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "4500");
    await userEvent.type(screen.getByRole("textbox", { name: "Quick note (optional)" }), "Bus");
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    const draft = onMoreDetails.mock.calls[0]?.[0] as URLSearchParams | undefined;
    expect(draft?.toString()).toBe("amount=4500&accountId=a1&description=Bus");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the missing main account under the picker when the API says NO_DEFAULT_ACCOUNT", async () => {
    routeFetch({ accounts: false });
    fetchMock.mockImplementationOnce((input, init) =>
      Promise.resolve(
        urlOf(input).includes("/api/accounts")
          ? json({ data: [], pagination })
          : json({ code: "INTERNAL", message: String(init?.method) }, { status: 500 }),
      ),
    );
    renderSheet();
    await screen.findByRole("button", { name: /Account.*Choose an account/ });
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith("/api/transactions/quick") && init?.method === "POST")
        return Promise.resolve(
          json({ code: "NO_DEFAULT_ACCOUNT", message: "none" }, { status: 400 }),
        );
      return Promise.resolve(json({ data: [], pagination }));
    });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose an account: you don’t have a main one yet.",
    );
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toEqual({ amount: 500 });
  });
});
