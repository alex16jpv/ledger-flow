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
let pending = [
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

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

beforeEach(() => {
  fetchMock.mockReset();
  search = "focus=q2";
  pending = pending.map((row) => ({ ...row, pendingDetails: true }));
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

  it("shows the all-reviewed state when nothing is pending", async () => {
    pending = [];
    render();
    expect(await screen.findByRole("heading", { name: "All reviewed" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/home");
  });
});
