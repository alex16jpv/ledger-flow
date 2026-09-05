import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import { setCurrentVault } from "@/lib/local/repository/read";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { TransactionDetailScreen } from "./TransactionDetailScreen";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/transactions/t1",
  Link: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string | { pathname: string };
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const pagination = { limit: 100, offset: 0, total: 2, hasMore: false, nextCursor: null };
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
  tags: ["work", "latte"],
  note: "Rain, missed the bus.",
  pendingDetails: false,
  source: "MANUAL",
  currency: "COP",
  createdAt: "2026-08-22T23:12:00.000Z",
  updatedAt: "2026-08-22T23:15:00.000Z",
};

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.includes("/api/accounts"))
      return Promise.resolve(
        json({
          data: [
            {
              id: "a1",
              name: "Visa Gold",
              type: "CARD",
              balance: 1,
              isDefault: false,
              color: "PURPLE",
            },
          ],
          pagination,
        }),
      );
    if (url.includes("/api/categories"))
      return Promise.resolve(
        json({
          data: [{ id: "c1", name: "Transport", icon: "car", color: "BLUE", type: "EXPENSE" }],
          pagination,
        }),
      );
    if (url.endsWith("/api/transactions/t1") && init?.method === "DELETE")
      return Promise.resolve(json({ message: "ok" }));
    if (url.endsWith("/api/transactions/t1")) return Promise.resolve(json(stored));
    return Promise.resolve(json({ code: "NOT_FOUND", message: "missing" }, { status: 404 }));
  });
});

afterEach(async () => {
  resetOutboxStatus();
  setCurrentVault(null);
  vi.unstubAllGlobals();
  await wipeVaults();
});

function render(id = "t1") {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <TransactionDetailScreen id={id} />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("TransactionDetailScreen", () => {
  it("shows the hero, the attributes and the footer, and links to the edit form", async () => {
    render();
    expect(await screen.findByRole("heading", { level: 2, name: "Uber to work" })).toBeVisible();
    expect(screen.getByText("Expense · Visa Gold")).toBeVisible();
    expect(screen.getByText("Transport")).toBeVisible();
    expect(screen.getByText("Rain, missed the bus.")).toBeVisible();
    expect(screen.getByText("latte")).toBeVisible();
    expect(screen.getByText("Manual")).toBeVisible();
    expect(screen.getByText("COP")).toBeVisible();
    expect(screen.getByText(/Created .* · edited/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/transactions/t1/edit",
    );
    expect(screen.queryByText(/still needs a category/)).not.toBeInTheDocument();
  });

  it("deletes after confirming and returns to the list", async () => {
    render();
    await screen.findByRole("heading", { level: 2, name: "Uber to work" });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this transaction?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/transactions");
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
    expect(await screen.findByText("Transaction deleted")).toBeVisible();
  });

  it("offers to complete a pending quick expense and shows not-found for a missing id", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).endsWith("/api/transactions/t1")
          ? json({
              ...stored,
              pendingDetails: true,
              source: "QUICK",
              categoryId: null,
              description: null,
            })
          : json({ data: [], pagination }),
      ),
    );
    render();
    expect(await screen.findByRole("link", { name: "Complete" })).toHaveAttribute(
      "href",
      "/transactions/review",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Quick expense" })).toBeVisible();
    expect(screen.getByText("Quick add")).toBeVisible();
  });

  // F-29: DESIGN §8.12 asks for the conflict sheet from Movements too, and the list row is a
  // button, so the way in is the detail screen.
  it("opens the conflict of the movement it is showing", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("outbox", {
      seq: 7,
      opId: "op-7",
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "update",
      occurredAt: "2026-09-04T10:00:00.000Z",
      payload: { body: { amount: 18400 } },
      dependsOn: [],
      status: "conflict",
      attempts: 1,
      lastError: "STALE_UPDATE",
    });
    setCurrentVault(vault);
    await refreshOutboxStatus(vault.db);
    render();

    await userEvent.click(await screen.findByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent("Resolve sync conflict");
    });
  });

  it("shows the not-found state for a missing id", async () => {
    render("nope");
    expect(
      await screen.findByRole("heading", {
        name: "This transaction doesn’t exist or was deleted.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });
});
