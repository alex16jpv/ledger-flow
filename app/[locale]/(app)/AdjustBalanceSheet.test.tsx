import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { UUID } from "@/lib/testing/ids";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account, Transaction } from "@/types/api";

import {
  AdjustBalanceSheet,
  adjustmentChanges,
  adjustmentInput,
  EditAdjustmentSheet,
} from "./AdjustBalanceSheet";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();

const account: Account = {
  id: "banco",
  name: "Bancolombia",
  type: "ACCOUNT",
  balance: 3_420_500,
  openingBalance: 2_500_000,
  color: "BLUE",
  userId: "u1",
  isDefault: true,
  currency: "COP",
  archivedAt: null,
  createdAt: "2026-03-12T12:00:00Z",
  updatedAt: "2026-03-12T12:00:00Z",
};

const round = (amount: number) => Math.round(amount);

const visa = (balance: number): Account => ({
  ...account,
  id: "visa",
  name: "Visa",
  type: "CARD",
  balance,
  creditLimit: 4_000_000,
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adjustmentInput", () => {
  it("books a decrease from the account and an increase into it, and nothing at delta zero", () => {
    const now = new Date("2026-09-02T15:00:00Z");
    expect(adjustmentInput(account, 3_408_200, " fee ", round, now)).toEqual({
      type: "ADJUSTMENT",
      amount: 12_300,
      date: "2026-09-02T15:00:00.000Z",
      fromAccountId: "banco",
      toAccountId: null,
      categoryId: null,
      note: "fee",
    });
    expect(adjustmentInput(account, 3_500_000, "", round, now)).toMatchObject({
      amount: 79_500,
      fromAccountId: null,
      toAccountId: "banco",
      note: null,
    });
    expect(adjustmentInput(account, 3_420_500, "", round, now)).toBeNull();
  });

  it("handles a debt account whose actual balance is negative", () => {
    const card = { id: "visa", balance: -1_245_900 };
    expect(adjustmentInput(card, -1_300_000, "", round)).toMatchObject({
      amount: 54_100,
      fromAccountId: "visa",
    });
  });
});

describe("AdjustBalanceSheet", () => {
  it("starts at the recorded balance with the button disabled, then previews the delta and posts the adjustment", async () => {
    fetchMock.mockResolvedValue(json({ id: "t1" }, { status: 201 }));
    const onClose = vi.fn();
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={account} open onClose={onClose} />
        </ToastProvider>
      </QueryProvider>,
    );
    const amount = screen.getByRole("textbox", { name: "Actual balance in Bancolombia" });
    expect(amount).toHaveValue("3,420,500");
    expect(screen.getByText("Recorded balance: $3,420,500")).toBeInTheDocument();
    expect(screen.getByText(/already matches/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save adjustment" })).toBeDisabled();

    await userEvent.clear(amount);
    await userEvent.type(amount, "3408200");
    expect(screen.getByText("An adjustment of −$12,300")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Note/), "August bank fee");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const [url, init] = writes()[0] ?? [];
    expect(url).toBe("/api/transactions");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBeNull();
    expect(JSON.parse(init?.body as string)).toMatchObject({
      id: expect.stringMatching(UUID),
      type: "ADJUSTMENT",
      amount: 12_300,
      fromAccountId: "banco",
      toAccountId: null,
      note: "August bank fee",
    });
    expect(screen.getByText("Adjustment saved")).toBeInTheDocument();
  });

  it("asks a card what it owes, reads the difference as debt, and keeps the form open on a server error", async () => {
    fetchMock.mockResolvedValue(json({ code: "DB_UNAVAILABLE", message: "down" }, { status: 503 }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={visa(-1_245_900)} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.getByRole("button", { name: "Owed", pressed: true })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Negative (debt)" })).not.toBeInTheDocument();
    expect(screen.getByText("Recorded: $1,245,900 owed")).toBeInTheDocument();
    const amount = screen.getByRole("textbox", { name: "How much do you owe on Visa right now?" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "1300000");
    expect(screen.getByText("$54,100 more owed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn’t respond/);
    expect(
      screen.getByRole("textbox", { name: "How much do you owe on Visa right now?" }),
    ).toHaveValue("1,300,000");
  });

  it("books less owed when the debt goes down", async () => {
    fetchMock.mockResolvedValue(json({ id: "t9" }, { status: 201 }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={visa(-1_245_900)} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    const amount = screen.getByRole("textbox", { name: "How much do you owe on Visa right now?" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "1233600");
    expect(screen.getByText("$12,300 less owed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = writes()[0] ?? [];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      type: "ADJUSTMENT",
      amount: 12_300,
      fromAccountId: null,
      toAccountId: "visa",
    });
  });

  it("opens on your own money when the card holds some, and stops talking debt across zero", async () => {
    fetchMock.mockResolvedValue(json({ id: "t9" }, { status: 201 }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={visa(4_000_000)} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.getByRole("button", { name: "Your own money", pressed: true })).toBeVisible();
    expect(screen.getByText("Recorded: $4,000,000 of your own money on it")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "How much of your own money is on Visa right now?" }),
    ).toHaveValue("4,000,000");

    await userEvent.click(screen.getByRole("button", { name: "Owed" }));
    expect(screen.getByText("An adjustment of −$8,000,000")).toBeInTheDocument();
    expect(screen.queryByText(/more owed/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = writes()[0] ?? [];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      amount: 8_000_000,
      fromAccountId: "visa",
      toAccountId: null,
    });
  });

  it("says nothing about debt when only your own money on the card moves", async () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={visa(4_000_000)} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    const amount = screen.getByRole("textbox", {
      name: "How much of your own money is on Visa right now?",
    });
    await userEvent.clear(amount);
    await userEvent.type(amount, "5000000");
    expect(screen.getByText("An adjustment of +$1,000,000")).toBeInTheDocument();
    expect(screen.queryByText(/owed/)).not.toBeInTheDocument();
  });

  it("starts an overdraft that owes nothing at zero owed, and counts the debt from there", async () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet
            account={{ ...visa(0), type: "OVERDRAFT", name: "Overdraft" }}
            open
            onClose={vi.fn()}
          />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.getByRole("button", { name: "Owed", pressed: true })).toBeVisible();
    expect(screen.getByText("Recorded: $0 owed")).toBeInTheDocument();
    const amount = screen.getByRole("textbox", {
      name: "How much do you owe on Overdraft right now?",
    });
    await userEvent.clear(amount);
    await userEvent.type(amount, "12300");
    expect(screen.getByText("$12,300 more owed")).toBeInTheDocument();
  });

  it("asks a loan only what it owes, because it cannot hold money of its owner", async () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet
            account={{ ...visa(-8_400_000), type: "LOAN", name: "Car loan" }}
            open
            onClose={vi.fn()}
          />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.queryByRole("button", { name: "Your own money" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Owed" })).not.toBeInTheDocument();
    expect(screen.getByText("Recorded: $8,400,000 owed")).toBeInTheDocument();
    const amount = screen.getByRole("textbox", {
      name: "How much do you owe on Car loan right now?",
    });
    expect(amount).toHaveValue("8,400,000");
    await userEvent.clear(amount);
    await userEvent.type(amount, "8250000");
    expect(screen.getByText("$150,000 less owed")).toBeInTheDocument();
  });

  it("opens a loan that drifted into credit at nothing owed, and says what is recorded", () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet
            account={{ ...visa(200_000), type: "LOAN", name: "Car loan" }}
            open
            onClose={vi.fn()}
          />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(
      screen.getByRole("textbox", { name: "How much do you owe on Car loan right now?" }),
    ).toHaveValue("0");
    expect(screen.getByText("Recorded: $200,000 paid past what it owed")).toBeInTheDocument();
    expect(screen.getByText("An adjustment of −$200,000")).toBeInTheDocument();
  });

  it("keeps the sign pair on an account that is not debt", async () => {
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet account={account} open onClose={vi.fn()} />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.queryByRole("button", { name: "Owed" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Negative (debt)" }));
    expect(screen.getByText("An adjustment of −$6,841,000")).toBeInTheDocument();
  });
});

const adjustment: Transaction = {
  id: "t7",
  type: "ADJUSTMENT",
  amount: 12_300,
  date: "2026-09-21T14:00:00.000Z",
  dayKey: "2026-09-21",
  categoryId: null,
  description: null,
  fromAccountId: "banco",
  toAccountId: null,
  userId: "u1",
  tags: [],
  note: "August bank fee",
  pendingDetails: false,
  source: "MANUAL",
  currency: "COP",
  countsAsYours: 12_300,
  sharedExpenseId: null,
  sharedGroupId: null,
  sharedSettlementId: null,
  importedFromGroupId: null,
  importedFromExpenseId: null,
  sharedHistory: [],
  createdAt: "",
  updatedAt: "",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

// The editing sheet reads the account the adjustment names, so a write is not the only route.
function routeEditing(write: () => Response) {
  fetchMock.mockImplementation((input, init) =>
    Promise.resolve(
      (init?.method ?? "GET") === "GET" && urlOf(input).includes("/api/accounts/")
        ? json(account)
        : write(),
    ),
  );
}

const writes = () => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");

async function renderEditing(row: Transaction = adjustment, currency = "COP") {
  const onClose = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <EditAdjustmentSheet adjustment={row} open onClose={onClose} />
      </ToastProvider>
    </QueryProvider>,
    { currency },
  );
  await screen.findByText(/Recorded on/);
  return { onClose };
}

describe("adjustmentChanges", () => {
  it("sends only what moved, and both sides when the direction did", () => {
    expect(adjustmentChanges(adjustment, account, 12_300, "decrease", "August bank fee")).toEqual(
      {},
    );
    expect(adjustmentChanges(adjustment, account, 9_000, "decrease", "August bank fee")).toEqual({
      amount: 9_000,
    });
    expect(adjustmentChanges(adjustment, account, 12_300, "increase", "August bank fee")).toEqual({
      fromAccountId: null,
      toAccountId: "banco",
    });
    expect(adjustmentChanges(adjustment, account, 12_300, "decrease", "  ")).toEqual({
      note: null,
    });
  });
});

// T-85: editing works on the adjustment's own amount, never on today's balance.
describe("AdjustBalanceSheet, editing one", () => {
  it("asks about its own amount, says what it did, and sends only the change", async () => {
    routeEditing(() => json({ ...adjustment, amount: 9_000 }));
    const { onClose } = await renderEditing();

    expect(screen.getByRole("dialog", { name: "Edit adjustment" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("12,300");
    expect(screen.getByRole("button", { name: "Decrease balance", pressed: true })).toBeVisible();
    expect(
      screen.getByText(/Recorded on Sep 21, it took −\$12,300 off Bancolombia/),
    ).toHaveTextContent("Changing the amount rewrites that difference, not today’s balance.");
    expect(screen.getByLabelText(/^Note/)).toHaveValue("August bank fee");
    expect(screen.queryByText(/Recorded balance/)).not.toBeInTheDocument();

    const amount = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "9000");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const [url, init] = writes()[0] ?? [];
    expect(url).toBe("/api/transactions/t7");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ amount: 9_000 });
    expect(screen.getByText("Adjustment updated")).toBeInTheDocument();
  });

  // T-93: editing an adjustment is the last door into a loan above zero, and it is shut too.
  it("refuses to push a loan past zero from the editing sheet", async () => {
    const loan: Account = {
      ...account,
      id: "loan",
      name: "Car loan",
      type: "LOAN",
      balance: -100_000,
      borrowedAmount: 12_000_000,
    };
    const paid: Transaction = {
      ...adjustment,
      id: "t8",
      amount: 50_000,
      fromAccountId: null,
      toAccountId: "loan",
    };
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        (init?.method ?? "GET") === "GET" && urlOf(input).includes("/api/accounts/")
          ? json(loan)
          : json(paid),
      ),
    );
    await renderEditing(paid);

    const amount = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "200000");
    expect(screen.getByText(/cannot be paid more than/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await userEvent.clear(amount);
    await userEvent.type(amount, "150000");
    expect(screen.queryByText(/cannot be paid more than/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("lets a loan with cents be paid off to the cent from the editing sheet [T-158]", async () => {
    const loan: Account = {
      ...account,
      id: "loan",
      name: "Car loan",
      type: "LOAN",
      balance: -0.36,
      borrowedAmount: 1_000,
      currency: "USD",
    };
    const paid: Transaction = {
      ...adjustment,
      id: "t9",
      amount: 0.1,
      currency: "USD",
      countsAsYours: 0.1,
      fromAccountId: null,
      toAccountId: "loan",
    };
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        (init?.method ?? "GET") === "GET" && urlOf(input).includes("/api/accounts/")
          ? json(loan)
          : json(paid),
      ),
    );
    await renderEditing(paid, "USD");

    const amount = screen.getByRole("textbox", { name: "Amount" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "0.46");
    expect(screen.queryByText(/cannot be paid more than/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    await userEvent.clear(amount);
    await userEvent.type(amount, "0.47");
    expect(screen.getByText(/cannot be paid more than/)).toBeVisible();
  });

  it("turns a decrease into an increase by moving the side, not the amount", async () => {
    routeEditing(() => json(adjustment));
    await renderEditing();

    await userEvent.click(screen.getByRole("button", { name: "Increase balance" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(writes()).toHaveLength(1);
    });
    expect(JSON.parse(writes()[0]?.[1]?.body as string)).toEqual({
      fromAccountId: null,
      toAccountId: "banco",
    });
  });

  it("deletes it after confirming", async () => {
    routeEditing(() => json({ message: "ok" }));
    const { onClose } = await renderEditing();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete this transaction?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(writes()[0]?.[1]?.method).toBe("DELETE");
  });

  it("saves nothing when nothing moved", async () => {
    routeEditing(() => json({ message: "unexpected" }, { status: 500 }));
    const { onClose } = await renderEditing();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(writes()).toHaveLength(0);
  });
});
