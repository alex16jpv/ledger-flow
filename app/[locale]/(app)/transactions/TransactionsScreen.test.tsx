import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { TransactionsScreen } from "./TransactionsScreen";

const replace = vi.fn();
const push = vi.fn();
let search = "";
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  usePathname: () => "/transactions",
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

class ObserverStub {
  readonly targets = new Set<Element>();
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const pagination = { limit: 30, offset: 0, total: 2, hasMore: false, nextCursor: null };
const rows = [
  {
    id: "t1",
    type: "EXPENSE",
    amount: 12500,
    date: "2026-08-31T23:00:00Z",
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
    id: "t2",
    type: "EXPENSE",
    amount: 4700,
    date: "2026-08-30T17:00:00Z",
    categoryId: "c1",
    description: "Tinto",
    fromAccountId: "a2",
    toAccountId: null,
    tags: ["coffee"],
    note: null,
    pendingDetails: false,
    source: "MANUAL",
  },
];

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

let listResponses: (() => Response)[] = [];

function routeFetch() {
  fetchMock.mockImplementation((input) => {
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
            { id: "a2", name: "Cash", type: "CASH", balance: 1, isDefault: false, color: "GRAY" },
          ],
          pagination,
        }),
      );
    if (url.includes("/api/categories"))
      return Promise.resolve(
        json({
          data: [{ id: "c1", name: "Coffee", icon: "coffee", color: "BROWN", type: "EXPENSE" }],
          pagination,
        }),
      );
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(
        json({
          groupBy: "day",
          total: url.includes("INCOME") ? 0 : 17200,
          buckets: url.includes("INCOME")
            ? []
            : [{ key: "2026-08-31", total: 12500, count: 1, avg: 12500 }],
        }),
      );
    if (url.includes("/api/transactions?") && !url.includes("limit=1")) {
      const next = listResponses.shift();
      return Promise.resolve(next ? next() : json({ data: rows, pagination }));
    }
    return Promise.resolve(json({ data: [], pagination: { ...pagination, total: 1 } }));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search = "period=lastMonth";
  listResponses = [];
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <TransactionsScreen />
      </ToastProvider>
    </QueryProvider>,
  );
}

describe("TransactionsScreen", () => {
  it("groups rows by local day with server totals, names quick rows and shows the badge", async () => {
    render();
    const day = await screen.findByRole("region", { name: "Monday, August 31" });
    expect(within(day).getByRole("button", { name: /Quick expense.*To review/ })).toBeVisible();
    expect(within(day).getByRole("button", { name: /Quick expense/ })).toHaveTextContent(
      "−$12,500",
    );
    expect(screen.getByRole("region", { name: "Sunday, August 30" })).toHaveTextContent("Tinto");
    expect(screen.getByRole("region", { name: "Sunday, August 30" })).toHaveTextContent("#coffee");
    expect(screen.getByText("Spent in Last month")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent("1");
  });

  it("writes filter chips to the URL", async () => {
    render();
    await screen.findByRole("region", { name: "Monday, August 31" });
    await userEvent.click(screen.getByRole("button", { name: "Expenses" }));
    expect(replace).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: { period: "lastMonth", type: "EXPENSE" },
    });
  });

  it("restarts from the first page and says so when the cursor is rejected", async () => {
    listResponses = [() => json({ code: "INVALID_CURSOR", message: "stale" }, { status: 400 })];
    render();
    expect(await screen.findByText("List refreshed")).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Monday, August 31" })).toBeVisible();
    });
  });
});
