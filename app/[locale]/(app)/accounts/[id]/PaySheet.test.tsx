import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { interestInput, payInput, PaySheet } from "./PaySheet";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

const isTransactions = (url: Parameters<typeof fetch>[0]): boolean =>
  (url instanceof Request ? url.url : url.toString()).includes("/api/transactions");
const fetchMock = vi.fn<typeof fetch>();

const account = (over: Partial<Account>): Account => ({
  id: "visa",
  name: "Visa Gold",
  type: "CARD",
  balance: -1_245_900,
  openingBalance: 0,
  color: "PURPLE",
  userId: "u1",
  isDefault: false,
  currency: "COP",
  archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const pagination = { limit: 100, offset: 0, total: 1, hasMore: false, nextCursor: null };
const card = account({});
const main = account({ id: "banco", name: "Bancolombia", type: "ACCOUNT", balance: 3_420_500 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open() {
  const onClose = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PaySheet account={card} main={main} open onClose={onClose} />
      </ToastProvider>
    </QueryProvider>,
  );
  return onClose;
}

describe("payInput", () => {
  it("sends the money towards the debt account, which is the step people get backwards", () => {
    const input = payInput(card, main, 1_245_900, "cat-1", "Paid from outside");

    expect(input).toMatchObject({
      type: "TRANSFER",
      amount: 1_245_900,
      fromAccountId: "banco",
      toAccountId: "visa",
      categoryId: "cat-1",
    });
  });

  it("writes a one-sided adjustment when the money never was in the app", () => {
    const input = payInput(card, null, 500_000, "cat-1", "Paid from outside");

    expect(input).toMatchObject({
      type: "ADJUSTMENT",
      fromAccountId: null,
      toAccountId: "visa",
      categoryId: null,
      description: "Paid from outside",
    });
  });
});

const loan = account({
  id: "loan",
  name: "Car loan",
  type: "LOAN",
  balance: -8_400_000,
  borrowedAmount: 12_000_000,
});
const interestCategory = {
  id: "cat-interest",
  name: "Interest",
  icon: "percent",
  color: "INDIGO",
  type: "EXPENSE",
  seedKey: "interest",
  archivedAt: null,
};
const otherExpense = { ...interestCategory, id: "cat-food", name: "Food", seedKey: "food" };

function routeLoan(categories: unknown[]) {
  fetchMock.mockImplementation((url) => {
    const href = url instanceof Request ? url.url : url.toString();
    if (href.includes("/api/categories"))
      return Promise.resolve(json({ data: categories, pagination }));
    if (href.includes("/api/stats/spending"))
      return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
    if (isTransactions(url)) return Promise.resolve(json({ id: "t1" }, { status: 201 }));
    return Promise.resolve(json({ data: [main, loan] }));
  });
}

function openLoan() {
  const onClose = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <PaySheet account={loan} main={main} open onClose={onClose} />
      </ToastProvider>
    </QueryProvider>,
  );
  return onClose;
}

async function openSheet(name: string) {
  const sheets = await screen.findAllByRole("dialog", { name });
  const shown = sheets.find((sheet) => sheet.hasAttribute("open"));
  if (!shown) throw new Error(`no ${name} sheet is open`);
  return shown;
}

const bodies = () =>
  fetchMock.mock.calls
    .filter(([url, init]) => isTransactions(url) && (init?.method ?? "GET") === "POST")
    .map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>);

describe("the instalment split (T-94)", () => {
  it("splits the instalment into a transfer and an expense, in that order", async () => {
    routeLoan([interestCategory]);
    const onClose = openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");

    expect(
      await screen.findByText(
        /Bancolombia −\$420,000 · Car loan \$294,000 less owed\. \$126,000 of that is spending/,
      ),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    expect(bodies()).toMatchObject([
      { type: "TRANSFER", amount: 294_000, fromAccountId: "banco", toAccountId: "loan" },
      {
        type: "EXPENSE",
        amount: 126_000,
        fromAccountId: "banco",
        toAccountId: null,
        categoryId: "cat-interest",
        description: "Interest on Car loan",
      },
    ]);
  });

  it("writes one movement while the interest is empty, exactly as before", async () => {
    routeLoan([interestCategory]);
    const onClose = openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    expect(bodies()).toHaveLength(1);
    expect(bodies()[0]).toMatchObject({ type: "TRANSFER", amount: 420_000 });
  });

  it("caps the principal, not the instalment: interest may take it past what is owed", async () => {
    routeLoan([interestCategory]);
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "8500000");
    expect(await screen.findByText(/cannot be paid more than/)).toBeVisible();

    await userEvent.type(screen.getByLabelText("Of which interest"), "200000");
    await waitFor(() => {
      expect(screen.queryByText(/cannot be paid more than/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("refuses an instalment that is all interest, because nothing would lower the loan", async () => {
    routeLoan([interestCategory]);
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "420000");

    expect(await screen.findByText(/cannot be the whole instalment/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();
    expect(screen.queryByText(/less owed/)).not.toBeInTheDocument();
  });

  it("asks where the interest goes when the account has no Interest category", async () => {
    routeLoan([otherExpense]);
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    expect(await screen.findByText(/no Interest category yet/)).toBeVisible();
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");

    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /^Where the interest goes/ }));
    const picking = await openSheet("Category");
    await userEvent.click(await within(picking).findByRole("option", { name: /Food/ }));
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() => {
      expect(bodies()).toHaveLength(2);
    });
    expect(bodies()[1]).toMatchObject({ type: "EXPENSE", categoryId: "cat-food" });
  });

  it("keeps the sheet open when only the payment landed, and sends the rest again", async () => {
    let posts = 0;
    fetchMock.mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      if (href.includes("/api/categories"))
        return Promise.resolve(json({ data: [interestCategory], pagination }));
      if (isTransactions(url) && (init?.method ?? "GET") === "POST") {
        posts += 1;
        return posts === 2
          ? Promise.resolve(json({ code: "INTERNAL", message: "no" }, { status: 500 }))
          : Promise.resolve(json({ id: `t${String(posts)}` }, { status: 201 }));
      }
      return Promise.resolve(json({ data: [main, loan] }));
    });
    const onClose = openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));

    expect(await screen.findByText(/Only half of this arrived/)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    const again = screen.getByRole("button", { name: "Send it again" });

    await userEvent.click(again);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    // Three POSTs, and only one of them is the transfer: the payment is never sent twice.
    expect(bodies().filter((body) => body.type === "TRANSFER")).toHaveLength(1);
  });

  it("freezes what was typed once the payment landed, so Send it again cannot send something else", async () => {
    let posts = 0;
    fetchMock.mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      if (href.includes("/api/categories"))
        return Promise.resolve(json({ data: [interestCategory], pagination }));
      if (isTransactions(url) && (init?.method ?? "GET") === "POST") {
        posts += 1;
        return posts === 2
          ? Promise.resolve(json({ code: "INTERNAL", message: "no" }, { status: 500 }))
          : Promise.resolve(json({ id: `t${String(posts)}` }, { status: 201 }));
      }
      return Promise.resolve(json({ data: [main, loan] }));
    });
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await screen.findByText(/Only half of this arrived/);

    expect(screen.getByLabelText("Amount to pay")).toBeDisabled();
    expect(screen.getByLabelText("Of which interest")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Everything owed/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^From/ })).toBeDisabled();
  });

  it("still asks before closing while half of it is unsaved", async () => {
    let posts = 0;
    fetchMock.mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      if (href.includes("/api/categories"))
        return Promise.resolve(json({ data: [interestCategory], pagination }));
      if (isTransactions(url) && (init?.method ?? "GET") === "POST") {
        posts += 1;
        return posts === 2
          ? Promise.resolve(json({ code: "INTERNAL", message: "no" }, { status: 500 }))
          : Promise.resolve(json({ id: `t${String(posts)}` }, { status: 201 }));
      }
      return Promise.resolve(json({ data: [main, loan] }));
    });
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await screen.findByText(/Only half of this arrived/);

    fireEvent(
      screen.getByRole("dialog", { name: "Pay Car loan" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.getByText("Are you sure you want to leave?")).toBeVisible();
  });

  it("everything owed means the loan ends at zero, with the interest on top", async () => {
    routeLoan([interestCategory]);
    openLoan();

    await userEvent.type(await screen.findByLabelText("Of which interest"), "126000");
    await userEvent.click(screen.getByRole("button", { name: /^Everything owed/ }));

    expect(screen.getByLabelText("Amount to pay")).toHaveValue("8,526,000");
    expect(screen.getByRole("button", { name: /^Everything owed/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Car loan \$8,400,000 less owed/)).toBeVisible();
  });

  it("drops the interest when the money turns out to come from outside", async () => {
    routeLoan([interestCategory]);
    openLoan();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420000");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126000");
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    await userEvent.click(
      within(await openSheet("Account")).getByRole("option", { name: /Somewhere else/ }),
    );

    expect(screen.queryByLabelText("Of which interest")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => {
      expect(bodies()).toHaveLength(1);
    });
    expect(bodies()[0]).toMatchObject({ type: "ADJUSTMENT", amount: 420_000 });
  });

  it("splits in minor units, so a currency with cents does not drift", async () => {
    routeLoan([interestCategory]);
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PaySheet account={loan} main={main} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
      { currency: "USD" },
    );

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "420.07");
    await userEvent.type(screen.getByLabelText("Of which interest"), "126.03");
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() => {
      expect(bodies()).toHaveLength(2);
    });
    expect(bodies()[0]).toMatchObject({ type: "TRANSFER", amount: 294.04 });
  });

  it("does not offer the split on a card, or when the money comes from outside", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();
    expect(await screen.findByLabelText("Amount to pay")).toBeVisible();
    expect(screen.queryByLabelText("Of which interest")).not.toBeInTheDocument();

    routeLoan([interestCategory]);
    openLoan();
    const sheets = await screen.findAllByRole("dialog");
    const loanSheet = sheets[sheets.length - 1];
    expect(within(loanSheet ?? document.body).getByLabelText("Of which interest")).toBeVisible();
  });
});

describe("PaySheet", () => {
  it("opens empty, with nothing decided and nothing to read back (T-99)", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    expect(await screen.findByLabelText("Amount to pay")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();
    expect(screen.queryByText(/less owed/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Another amount/ })).not.toBeInTheDocument();
  });

  it("carries the total on the chip that fills the field, as the second option it now is", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    const chip = await screen.findByRole("button", { name: "Everything owed · $1,245,900" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);

    expect(screen.getByLabelText("Amount to pay")).toHaveValue("1,245,900");
    expect(screen.getByRole("button", { name: /^Everything owed/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("Bancolombia −$1,245,900 · Visa Gold $1,245,900 less owed."),
    ).toBeInTheDocument();
  });

  it("takes an amount of the user's own, which is the whole point of T-99", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    await userEvent.type(await screen.findByLabelText("Amount to pay"), "300000");
    expect(screen.getByRole("button", { name: /^Everything owed/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByText("Bancolombia −$300,000 · Visa Gold $300,000 less owed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("replaces an amount already typed, and gives it back on a second press", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    const amount = await screen.findByLabelText("Amount to pay");
    await userEvent.type(amount, "300000");
    await userEvent.click(screen.getByRole("button", { name: /^Everything owed/ }));
    expect(amount).toHaveValue("1,245,900");

    await userEvent.click(screen.getByRole("button", { name: /^Everything owed/ }));
    expect(amount).toHaveValue("");
    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();
  });

  it("does not move the keyboard away from the chip that was pressed", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    const chip = await screen.findByRole("button", { name: /^Everything owed/ });
    await userEvent.click(chip);
    expect(chip).toHaveFocus();
    expect(screen.getByLabelText("Amount to pay")).toHaveValue("1,245,900");
  });

  it("asks before leaving once something is typed, and not before", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    await screen.findByLabelText("Amount to pay");
    const cancel = () =>
      fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));

    cancel();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Amount to pay"), "300000");
    cancel();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Are you sure you want to leave?");
  });

  it("offers the whole debt on a loan too, which is exactly its ceiling", async () => {
    const loan = account({ id: "loan", name: "Car loan", type: "LOAN", balance: -8_400_000 });
    fetchMock.mockResolvedValue(json({ data: [main, loan] }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PaySheet account={loan} main={main} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Everything owed · $8,400,000" }),
    );
    expect(screen.getByLabelText("Amount to pay")).toHaveValue("8,400,000");
    expect(screen.queryByText(/cannot be paid more than/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("records the payment as a transfer towards the card", async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        isTransactions(url) ? json({ id: "t1" }, { status: 201 }) : json({ data: [main, card] }),
      ),
    );
    const onClose = open();

    await userEvent.click(await screen.findByRole("button", { name: /^Everything owed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const call = fetchMock.mock.calls.find(([url]) => isTransactions(url));
    expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({
      type: "TRANSFER",
      amount: 1_245_900,
      fromAccountId: "banco",
      toAccountId: "visa",
    });
    // What makes a retry safe here is the client-minted id in the body, as everywhere else.
    expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({
      id: expect.stringMatching(UUID),
    });
  });

  it("pays from outside the app without inventing an income", async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        isTransactions(url) ? json({ id: "t1" }, { status: 201 }) : json({ data: [main, card] }),
      ),
    );
    open();

    await userEvent.click(await screen.findByRole("button", { name: /^Everything owed/ }));
    await userEvent.click(screen.getByRole("button", { name: /^From/ }));
    const sheet = screen.getByRole("dialog", { name: "Account" });
    await userEvent.click(within(sheet).getByRole("option", { name: /Somewhere else/ }));

    expect(
      screen.getByText(
        "Visa Gold $1,245,900 less owed. It does not count as income or as spending, because the money never was in Ledger Flow.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Pay" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => isTransactions(url))).toBe(true);
    });
    const call = fetchMock.mock.calls.find(([url]) => isTransactions(url));
    expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({
      type: "ADJUSTMENT",
      fromAccountId: null,
      toAccountId: "visa",
    });
  });

  it("never offers the account being paid as the source, even when it is the main one (T-88)", async () => {
    fetchMock.mockResolvedValue(json({ data: [card] }));
    const onClose = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PaySheet account={card} main={{ ...card, isDefault: true }} open onClose={onClose} />
        </ToastProvider>
      </QueryProvider>,
    );

    expect(await screen.findByRole("button", { name: "Pay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^From/ })).toHaveTextContent("Choose an account");
  });

  it("refuses to pay a loan more than it owes, and says how much that is", async () => {
    const loan = account({ id: "loan", name: "Car loan", type: "LOAN", balance: -8_400_000 });
    fetchMock.mockResolvedValue(json({ data: [main, loan] }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <PaySheet account={loan} main={main} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );

    const amount = await screen.findByLabelText("Amount to pay");
    await userEvent.type(amount, "9000000");
    expect(
      screen.getByText("A loan cannot be paid more than the $8,400,000 it still owes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();
    expect(screen.queryByText(/less owed/)).not.toBeInTheDocument();

    await userEvent.clear(amount);
    await userEvent.type(amount, "8400000");
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("keeps letting a card be overpaid, because a bank does too", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    const amount = await screen.findByLabelText("Amount to pay");
    await userEvent.type(amount, "2000000");
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("refuses to pay nothing once the field has been emptied again", async () => {
    fetchMock.mockResolvedValue(json({ data: [main, card] }));
    open();

    const amount = await screen.findByLabelText("Amount to pay");
    await userEvent.type(amount, "300000");
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();

    await userEvent.clear(amount);
    expect(screen.getByRole("button", { name: "Pay" })).toBeDisabled();
    expect(screen.queryByText(/less owed/)).not.toBeInTheDocument();
  });
});

describe("interestInput", () => {
  it("is an expense from the account the instalment was paid with", () => {
    expect(interestInput(main, 126_000, "cat-interest", "Interest on Car loan")).toMatchObject({
      type: "EXPENSE",
      amount: 126_000,
      fromAccountId: "banco",
      toAccountId: null,
      categoryId: "cat-interest",
      description: "Interest on Car loan",
    });
  });
});
