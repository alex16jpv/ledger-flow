import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { setCurrentVault } from "@/lib/local/repository/read";
import { profileRecord, transactionRecord } from "@/lib/local/schema";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";

import { ReviewScreen } from "./ReviewScreen";

let search = "";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/transactions/review",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const scrollSpy = vi.fn();
const pagination = { limit: 30, offset: 0, total: 2, hasMore: false, nextCursor: null };
const INITIAL = [
  {
    id: "q1",
    type: "EXPENSE",
    amount: 12500,
    date: "2026-08-31T13:42:00Z",
    categoryId: null,
    description: null,
    fromAccountId: "a1",
    toAccountId: null,
    tags: [],
    note: null,
    pendingDetails: true,
    source: "QUICK",
  },
  {
    id: "q2",
    type: "EXPENSE",
    amount: 15400,
    date: "2026-08-30T18:05:00Z",
    categoryId: null,
    description: null,
    fromAccountId: "a1",
    toAccountId: null,
    tags: [],
    note: null,
    pendingDetails: true,
    source: "QUICK",
  },
];
let pending = INITIAL.map((row) => ({ ...row }));

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

beforeEach(() => {
  fetchMock.mockReset();
  search = "focus=q2";
  pending = INITIAL.map((row) => ({ ...row, pendingDetails: true }));
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = scrollSpy;
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (url.includes("/api/accounts"))
      return Promise.resolve(
        json({
          data: [
            {
              id: "a1",
              name: "Bancolombia",
              type: "ACCOUNT",
              balance: 1,
              isDefault: true,
              color: "BLUE",
            },
          ],
          pagination,
        }),
      );
    if (url.includes("/api/categories"))
      return Promise.resolve(
        json({
          data: [
            { id: "c1", name: "Food", icon: "utensils", color: "ORANGE", type: "EXPENSE" },
            { id: "c2", name: "Coffee", icon: "coffee", color: "BROWN", type: "EXPENSE" },
          ],
          pagination,
        }),
      );
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(
        json({
          groupBy: "category",
          total: 0,
          buckets: [
            { key: "c2", total: 9, count: 9, avg: 1 },
            { key: "c1", total: 4, count: 4, avg: 1 },
          ],
        }),
      );
    if (url.includes("/api/transactions/q1") && init?.method === "PUT") {
      pending = pending.filter((row) => row.id !== "q1");
      return Promise.resolve(json({ ...pending[0], id: "q1", pendingDetails: false }));
    }
    if (url.includes("/api/transactions?"))
      return Promise.resolve(
        json({
          data: pending,
          pagination: { ...pagination, total: pending.length },
          summary: { totalAmount: pending.reduce((sum, row) => sum + row.amount, 0) },
        }),
      );
    return Promise.resolve(json({ code: "NOT_FOUND", message: url }, { status: 404 }));
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  setCurrentVault(null);
  await wipeVaults();
});

function render() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <ReviewScreen />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("ReviewScreen", () => {
  it("lists the pending quick expenses with recent chips and completes one in place", async () => {
    render();
    expect(await screen.findByRole("heading", { level: 1, name: "To review · 2" })).toBeVisible();
    expect(await screen.findByText("27,900")).toBeVisible();
    const cards = await screen.findAllByRole("group", { name: "Category" });
    expect(cards).toHaveLength(2);
    const first = document.querySelector<HTMLElement>('[data-transaction-id="q1"]');
    if (!first) throw new Error("card q1 not rendered");
    expect(
      within(first)
        .getAllByRole("button", { pressed: false })
        .map((chip) => chip.textContent),
    ).toEqual(["Coffee", "Food", "Other"]);
    expect(scrollSpy).toHaveBeenCalled();

    await userEvent.click(within(first).getByRole("button", { name: "Coffee" }));
    await userEvent.type(within(first).getByRole("textbox", { name: "Description" }), "Latte");
    await userEvent.click(within(first).getByRole("button", { name: "Done" }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({
      categoryId: "c2",
      description: "Latte",
      pendingDetails: false,
    });
    expect(await screen.findByText("Details saved")).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "To review · 1" })).toBeVisible();
    });
    expect(screen.queryByText("−$12,500")).not.toBeInTheDocument();
  });

  it("saves every categorized card row by row and keeps the failed one with its error", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      // F-20: the lot leaves as one operation per row, each addressed by its own id and guarded on
      // its own, so one refusal does not take the rest of the batch down with it.
      const row = /\/api\/transactions\/(q1|q2)$/.exec(url);
      if (row && init?.method === "PUT") {
        if (row[1] === "q2") {
          return Promise.resolve(
            json({ code: "CATEGORY_ARCHIVED", message: "archived" }, { status: 409 }),
          );
        }
        pending = pending.filter((entry) => entry.id !== "q1");
        return Promise.resolve(
          json({ ...INITIAL[0], categoryId: "c2", description: "Latte", pendingDetails: false }),
        );
      }
      if (url.includes("/api/accounts"))
        return Promise.resolve(
          json({
            data: [
              {
                id: "a1",
                name: "Bancolombia",
                type: "ACCOUNT",
                balance: 1,
                isDefault: true,
                color: "BLUE",
              },
            ],
            pagination,
          }),
        );
      if (url.includes("/api/categories"))
        return Promise.resolve(
          json({
            data: [
              { id: "c1", name: "Food", icon: "utensils", color: "ORANGE", type: "EXPENSE" },
              { id: "c2", name: "Coffee", icon: "coffee", color: "BROWN", type: "EXPENSE" },
            ],
            pagination,
          }),
        );
      if (url.includes("/api/stats/spending"))
        return Promise.resolve(
          json({
            groupBy: "category",
            total: 0,
            buckets: [
              { key: "c2", total: 9, count: 9, avg: 1 },
              { key: "c1", total: 4, count: 4, avg: 1 },
            ],
          }),
        );
      if (url.includes("/api/transactions?"))
        return Promise.resolve(
          json({
            data: pending,
            pagination: { ...pagination, total: pending.length },
            summary: { totalAmount: 0 },
          }),
        );
      return Promise.resolve(json({ code: "NOT_FOUND", message: url }, { status: 404 }));
    });
    render();
    await screen.findAllByRole("group", { name: "Category" });
    expect(screen.queryByRole("button", { name: /Save all/ })).not.toBeInTheDocument();
    const first = document.querySelector<HTMLElement>('[data-transaction-id="q1"]');
    const second = document.querySelector<HTMLElement>('[data-transaction-id="q2"]');
    if (!first || !second) throw new Error("cards not rendered");
    await userEvent.click(within(first).getByRole("button", { name: "Coffee" }));
    await userEvent.type(within(first).getByRole("textbox", { name: "Description" }), "Latte");
    expect(screen.getByRole("button", { name: "Save all · 1" })).toBeVisible();
    await userEvent.click(within(second).getByRole("button", { name: "Food" }));
    await userEvent.click(screen.getByRole("button", { name: "Save all · 2" }));

    const dialog = screen.getByRole("dialog", { name: "Save 2 expenses?" });
    expect(dialog).toHaveTextContent(
      "Each one keeps the category and description it has right now.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save 2" }));

    const saved = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(saved.map(([url]) => urlOf(url))).toEqual([
      "/api/transactions/q1",
      "/api/transactions/q2",
    ]);
    expect(saved.map(([, init]) => JSON.parse(init?.body as string) as unknown)).toEqual([
      { categoryId: "c2", description: "Latte", pendingDetails: false },
      { categoryId: "c1", description: null, pendingDetails: false },
    ]);
    // The row carries its own id, so no header has to stand in for it.
    expect(new Headers(saved[0]?.[1]?.headers).get("Idempotency-Key")).toBeNull();
    expect(await screen.findByText("1 saved · 1 with errors")).toBeVisible();
    await waitFor(() => {
      expect(document.querySelector('[data-transaction-id="q1"]')).toBeNull();
    });
    expect(within(second).getByRole("alert")).toHaveTextContent(/archived/);
  });

  it("shows the all-reviewed state when nothing is pending", async () => {
    pending = [];
    render();
    expect(await screen.findByRole("heading", { name: "All reviewed" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/home");
  });
  it("says why the server saved a movement without its category (F-57)", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("profile", profileRecord(profile()));
    for (const id of ["q1", "q2"]) {
      await vault.db.put(
        "transactions",
        transactionRecord({ ...transaction({ id }), categoryId: null, pendingDetails: true }),
      );
    }
    await vault.db.put("meta", {
      key: "syncNotices",
      value: JSON.stringify([
        { code: "CATEGORY_ARCHIVED_DROPPED", id: "q1", at: "2026-09-06T10:00:00.000Z" },
      ]),
    });
    setCurrentVault(vault);
    render();

    expect(await screen.findByText(/Its category had been archived/)).toBeVisible();
    // One row was warned about, not both.
    expect(screen.getAllByText(/Its category had been archived/)).toHaveLength(1);
  });
});
