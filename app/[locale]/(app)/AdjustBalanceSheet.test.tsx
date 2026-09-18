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
  editingAdjustment,
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
    const [url, init] = fetchMock.mock.calls[0] ?? [];
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

  it("lets a debt account go further negative and keeps the form open on a server error", async () => {
    fetchMock.mockResolvedValue(json({ code: "DB_UNAVAILABLE", message: "down" }, { status: 503 }));
    renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <AdjustBalanceSheet
            account={{ ...account, id: "visa", name: "Visa", balance: -1_245_900 }}
            open
            onClose={vi.fn()}
          />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(screen.getByRole("button", { name: "Negative (debt)", pressed: true })).toBeVisible();
    const amount = screen.getByRole("textbox", { name: "Actual balance in Visa" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "1300000");
    expect(screen.getByText("An adjustment of −$54,100")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn’t respond/);
    expect(screen.getByRole("textbox", { name: "Actual balance in Visa" })).toHaveValue(
      "1,300,000",
    );
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
  createdAt: "",
  updatedAt: "",
};

function renderSheet(props: Partial<React.ComponentProps<typeof AdjustBalanceSheet>> = {}) {
  const onClose = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <AdjustBalanceSheet account={account} open onClose={onClose} {...props} />
      </ToastProvider>
    </QueryProvider>,
  );
  return { onClose };
}

describe("editingAdjustment", () => {
  const accounts = new Map([[account.id, account]]);

  it("claims an adjustment on a known account and nothing else", () => {
    expect(editingAdjustment(adjustment, accounts)).toEqual({ transaction: adjustment, account });
    expect(
      editingAdjustment({ ...adjustment, fromAccountId: null, toAccountId: "banco" }, accounts),
    ).toEqual({
      transaction: { ...adjustment, fromAccountId: null, toAccountId: "banco" },
      account,
    });
    expect(editingAdjustment({ ...adjustment, type: "EXPENSE" }, accounts)).toBeNull();
    expect(editingAdjustment(adjustment, new Map())).toBeNull();
  });
});

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
    fetchMock.mockResolvedValue(json({ ...adjustment, amount: 9_000 }));
    const { onClose } = renderSheet({ adjustment });

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
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/transactions/t7");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ amount: 9_000 });
    expect(screen.getByText("Adjustment updated")).toBeInTheDocument();
  });

  it("turns a decrease into an increase by moving the side, not the amount", async () => {
    fetchMock.mockResolvedValue(json(adjustment));
    renderSheet({ adjustment });

    await userEvent.click(screen.getByRole("button", { name: "Increase balance" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      fromAccountId: null,
      toAccountId: "banco",
    });
  });

  it("deletes it after confirming", async () => {
    fetchMock.mockResolvedValue(json({ message: "ok" }));
    const { onClose } = renderSheet({ adjustment });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete this transaction?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });

  it("saves nothing when nothing moved", async () => {
    const { onClose } = renderSheet({ adjustment });
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
