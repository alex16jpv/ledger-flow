import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { payInput, PaySheet } from "./PaySheet";

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
      screen.getByText(
        "Bancolombia −$1,245,900 · Visa Gold $1,245,900 less owed. Your total balance does not change.",
      ),
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
      screen.getByText(
        "Bancolombia −$300,000 · Visa Gold $300,000 less owed. Your total balance does not change.",
      ),
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
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Amount to pay"), "300000");
    cancel();
    expect(screen.getByRole("alert")).toHaveTextContent("Are you sure you want to leave?");
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
