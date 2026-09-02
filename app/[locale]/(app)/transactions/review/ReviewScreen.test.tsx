import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

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

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("saves every categorized card in one batch and keeps the failed one with its error", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith("/api/transactions/batch") && init?.method === "PATCH") {
        const body = JSON.parse(init.body as string) as { items: { id: string }[] };
        pending = pending.filter((row) => row.id !== "q1");
        return Promise.resolve(
          json({
            updated: body.items.filter((item) => item.id === "q1"),
            failed: [{ id: "q2", code: "CATEGORY_ARCHIVED", message: "archived" }],
          }),
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

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
      items: [
        { id: "q1", categoryId: "c2", description: "Latte", pendingDetails: false },
        { id: "q2", categoryId: "c1", description: null, pendingDetails: false },
      ],
    });
    expect(new Headers(patch?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
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
});
