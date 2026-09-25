import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { urlOf } from "@/lib/testing/http";
import { UUID } from "@/lib/testing/ids";
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

const CARD_MAIN = [
  {
    id: "a1",
    name: "Visa Gold",
    type: "CARD",
    balance: -50,
    isDefault: true,
    color: "PURPLE",
    creditLimit: 400,
  },
  { id: "a2", name: "Cash", type: "CASH", balance: 5, isDefault: false, color: "GRAY" },
];

function routeFetch({ accounts = true, list = null as unknown[] | null } = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/accounts"))
      return Promise.resolve(
        json({
          data:
            list ??
            (accounts
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
              : []),
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
  // T-78 was first wired with a hook that never reached this sheet, and only a call-site test sees that.
  it("asks before a tap outside throws a half-typed capture away (T-78)", async () => {
    routeFetch();
    const { onClose } = renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });
    const scrim = screen.getByRole("dialog", { name: "Add" }).firstElementChild;
    expect(scrim).not.toBeNull();
    if (!scrim) return;

    const tapOutside = () => {
      fireEvent.pointerDown(scrim);
      fireEvent.pointerUp(scrim);
      fireEvent.click(scrim);
    };

    tapOutside();
    expect(onClose).toHaveBeenCalledOnce();

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "12500");
    tapOutside();
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Are you sure you want to leave?");
    expect(screen.getByRole("button", { name: "Save" }).closest("[inert]")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("saves in two interactions against the main account, adds the note and offers undo", async () => {
    routeFetch();
    const { onClose } = renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    await userEvent.click(
      within(screen.getByRole("group", { name: "Category" })).getByRole("button", {
        name: "Coffee",
      }),
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "12500");
    await userEvent.type(screen.getByRole("combobox", { name: "Quick note (optional)" }), "Latte");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const [post] = calls("POST");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      amount: 12500,
      type: "EXPENSE",
      categoryId: "c1",
      fromAccountId: "a1",
    });
    expect(new Headers(post?.[1]?.headers).get("Idempotency-Key")).toBeNull();
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

  it("keeps the sheet open after picking another account from the nested picker", async () => {
    routeFetch();
    const { onClose } = renderSheet();
    await userEvent.click(
      await screen.findByRole("button", { name: /From your main account.*Bancolombia/ }),
    );
    await userEvent.click(screen.getByRole("option", { name: /Cash/ }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Add" })).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: /^Account.*Cash/ })).toBeVisible();
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
    await userEvent.type(screen.getByRole("combobox", { name: "Quick note (optional)" }), "Bus");
    await userEvent.click(screen.getByRole("button", { name: "More details" }));
    const draft = onMoreDetails.mock.calls[0]?.[0] as URLSearchParams | undefined;
    expect(draft?.toString()).toBe("type=EXPENSE&amount=4500&accountId=a1&description=Bus");
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
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      amount: 500,
      type: "EXPENSE",
    });
  });

  // T-73: the sheet used to send an expense and nothing else, whatever the user meant.
  it("records an income into the main account, with the income categories", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });

    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(
      await screen.findByRole("button", { name: /Into your main account.*Bancolombia/ }),
    ).toBeVisible();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => urlOf(input).includes("type=INCOME"))).toBe(
        true,
      );
    });

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "9000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      amount: 9000,
      type: "INCOME",
      toAccountId: "a1",
    });
  });

  // T-93: a card can be the main account — a quick expense on it is ordinary — but an income cannot land there.
  it("asks for an account when the main one is a card and the entry is an income", async () => {
    routeFetch({ list: CARD_MAIN });
    renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Visa Gold/ });

    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(await screen.findByRole("button", { name: /^Account/ })).toHaveTextContent(
      "Choose an account",
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "9000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This field is required.")).toBeVisible();
    expect(calls("POST")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: /^Account/ }));
    const sheet = await screen.findByRole("dialog", { name: "Account" });
    expect(within(sheet).queryByRole("option", { name: /Visa Gold/ })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("option", { name: /Cash/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toMatchObject({
      type: "INCOME",
      toAccountId: "a2",
    });
  });

  it("asks a transfer for both sides and refuses the same account twice", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });

    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    // T-86: a transfer keeps the category row, filtered to the categories marked Transfer.
    expect(screen.getByRole("group", { name: "Category" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          /\/api\/categories\?.*type=TRANSFER/.test(urlOf(input)),
        ),
      ).toBe(true);
    });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "3000");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This field is required.");
    expect(calls("POST")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: /^To/ }));
    await userEvent.click(screen.getByRole("option", { name: /Cash/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls("POST")).toHaveLength(1);
    });
    expect(JSON.parse(calls("POST")[0]?.[1]?.body as string)).toEqual({
      id: expect.stringMatching(UUID),
      amount: 3000,
      type: "TRANSFER",
      fromAccountId: "a1",
      toAccountId: "a2",
    });
  });

  it("swaps the two sides of a transfer without losing the amount", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });

    await userEvent.click(screen.getByRole("button", { name: "Transfer" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "3000");
    await userEvent.click(screen.getByRole("button", { name: /^To/ }));
    await userEvent.click(screen.getByRole("option", { name: /Cash/ }));

    await userEvent.click(screen.getByRole("button", { name: "Swap accounts" }));

    expect(screen.getByRole("button", { name: /^From.*Cash/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^To.*Bancolombia/ })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("3,000");
  });

  // The design is explicit: switching type never clears the amount, and always clears the category.
  it("keeps the amount across a change of type and drops the category", async () => {
    routeFetch();
    renderSheet();
    await screen.findByRole("button", { name: /From your main account.*Bancolombia/ });
    await userEvent.type(screen.getByRole("textbox", { name: "Amount" }), "12500");
    await userEvent.click(
      within(screen.getByRole("group", { name: "Category" })).getByRole("button", {
        name: "Coffee",
      }),
    );
    expect(screen.getByRole("button", { name: "Coffee" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Income" }));

    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("12,500");
    expect(await screen.findByRole("button", { name: "Coffee" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not throw the category away when the type shown is tapped again", async () => {
    routeFetch();
    renderSheet();
    await userEvent.click(await screen.findByRole("button", { name: "Coffee" }));

    await userEvent.click(screen.getByRole("button", { name: "Expense" }));

    expect(screen.getByRole("button", { name: "Coffee" })).toHaveAttribute("aria-pressed", "true");
  });
});
