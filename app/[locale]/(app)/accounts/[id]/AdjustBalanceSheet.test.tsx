import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Account } from "@/types/api";

import { AdjustBalanceSheet, adjustmentInput } from "./AdjustBalanceSheet";

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
    expect(new Headers(init?.headers).get("Idempotency-Key")).toMatch(/[0-9a-f-]{36}/);
    expect(JSON.parse(init?.body as string)).toMatchObject({
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
