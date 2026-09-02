import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Budget } from "@/types/api";

import { BudgetDetailScreen } from "./BudgetDetailScreen";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace }),
  usePathname: () => "/budgets/b1",
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string | { pathname: string; query?: Record<string, string> };
    className?: string;
  }) => (
    <a
      className={className}
      href={
        typeof href === "string"
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`
      }
    >
      {children}
    </a>
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-22T15:00:00.000Z") });

const lifestyle: Budget = {
  id: "b1",
  name: "Lifestyle",
  color: "PINK",
  categoryIds: ["lifestyle", "vacation"],
  archivedCategoryIds: ["vacation"],
  type: "EXPENSE",
  currency: "COP",
  periodType: "MONTHLY",
  periodKey: "2026-09",
  periodFrom: "2026-09-01T05:00:00.000Z",
  periodTo: "2026-10-01T05:00:00.000Z",
  baseAmount: 250_000,
  amount: 300_000,
  spent: 356_000,
  hasOverride: true,
  expired: false,
  effectiveFrom: "2026-03-01T05:00:00.000Z",
  note: "Clothes, going out and treats.",
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
};

const empty = (data: unknown[] = []) =>
  json({
    data,
    pagination: { limit: 30, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function routeFetch(budget: Budget, onMutation?: (url: string, init: RequestInit) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (method !== "GET" && onMutation) return Promise.resolve(onMutation(url, init ?? {}));
    if (url.startsWith("/api/budgets/")) return Promise.resolve(json(budget));
    if (url.startsWith("/api/categories"))
      return Promise.resolve(
        empty([
          {
            id: "lifestyle",
            name: "Lifestyle",
            icon: "shopping-bag",
            color: "PINK",
            type: "EXPENSE",
            userId: "u",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "vacation",
            name: "Vacation",
            icon: "plane",
            color: "CYAN",
            type: "EXPENSE",
            userId: "u",
            archivedAt: "2026-08-01T00:00:00Z",
            createdAt: "",
            updatedAt: "",
          },
        ]),
      );
    return Promise.resolve(empty());
  });
}

function renderScreen() {
  renderWithProviders(
    <QueryProvider>
      <ToastProvider>
        <BudgetDetailScreen id="b1" />
      </ToastProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BudgetDetailScreen", () => {
  it("shows the hero, the override explanation, the categories with the archived mark and the links", async () => {
    routeFetch(lifestyle);
    renderScreen();
    expect(await screen.findByText("Lifestyle", { selector: "span.text-lg" })).toBeVisible();
    expect(screen.getByText("Monthly · Sep 1 – 30 · since March 2026")).toBeInTheDocument();
    expect(screen.getByText("Adjusted")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("9 days")).toBeInTheDocument();
    expect(
      screen.getByText(
        "September 2026 is adjusted to $300,000. Other periods keep the base amount.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("base $250,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove adjustment" })).toBeInTheDocument();
    const vacation = await screen.findByRole("button", { name: /Vacation/ });
    expect(within(vacation).getByText("archived")).toBeInTheDocument();
    expect(screen.getByText("Clothes, going out and treats.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/transactions?period=custom&from=2026-09-01&to=2026-09-30&type=EXPENSE",
    );
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/budgets/b1/edit");
  });

  it("changes, skips and removes the period override against the reference month", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    routeFetch(lifestyle, (url, init) => {
      calls.push({
        url,
        method: init.method ?? "GET",
        body: init.body ? JSON.parse(init.body as string) : null,
      });
      return json(lifestyle);
    });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Change adjustment" }));
    const sheet = screen.getByRole("dialog", { name: "Adjust this period" });
    const amount = within(sheet).getByRole("textbox", { name: "Amount for September 2026" });
    expect(amount).toHaveValue("300,000");
    expect(within(sheet).getByRole("button", { name: "Save adjustment" })).toBeDisabled();
    await userEvent.clear(amount);
    await userEvent.type(amount, "400000");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save adjustment" }));
    expect(await screen.findByText("Adjustment saved")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Skip this period" }));
    expect(await screen.findByText("Skipped for this period")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove adjustment" }));
    expect(await screen.findByText("Adjustment removed")).toBeVisible();

    expect(calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ["PUT", "/api/budgets/b1/amount?reference=2026-09-15T17%3A00%3A00.000Z", { amount: 400_000 }],
      ["PUT", "/api/budgets/b1/amount?reference=2026-09-15T17%3A00%3A00.000Z", { amount: 0 }],
      ["DELETE", "/api/budgets/b1/amount?reference=2026-09-15T17%3A00%3A00.000Z", null],
    ]);
  });

  it("archives after a confirmation and goes back to the list", async () => {
    const calls: string[] = [];
    routeFetch(lifestyle, (url, init) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      return new Response(null, { status: 204 });
    });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = screen.getByRole("dialog", { name: "Archive Lifestyle?" });
    expect(dialog).toHaveTextContent(/restore it later from Past budgets/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/budgets");
    });
    expect(calls).toEqual(["DELETE /api/budgets/b1"]);
  });

  it("explains an archived budget, hides the actions and restores it", async () => {
    const calls: string[] = [];
    routeFetch(
      { ...lifestyle, archivedAt: "2026-09-10T00:00:00Z", hasOverride: false },
      (url, init) => {
        calls.push(`${init.method ?? "GET"} ${url}`);
        return json(lifestyle);
      },
    );
    renderScreen();
    expect(await screen.findByText(/This budget is archived/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Change adjustment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("Budget restored")).toBeVisible();
    expect(calls).toEqual(["POST /api/budgets/b1/restore?reference=2026-09-15T17%3A00%3A00.000Z"]);
  });

  it("refuses an overlapping restore and names the budget in the way", async () => {
    const other = { ...lifestyle, id: "b2", name: "Treats", archivedAt: null };
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (init?.method === "POST")
        return Promise.resolve(
          json({ code: "BUDGET_PERIOD_OVERLAP", message: "overlap" }, { status: 400 }),
        );
      if (url.startsWith("/api/budgets?")) return Promise.resolve(empty([other]));
      if (url.startsWith("/api/budgets/"))
        return Promise.resolve(json({ ...lifestyle, archivedAt: "2026-09-10T00:00:00Z" }));
      return Promise.resolve(empty());
    });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "Restore" }));
    const dialog = await screen.findByRole("dialog", { name: "Another budget is in the way" });
    expect(dialog).toHaveTextContent("“Treats” is active for the same monthly period");
    expect(within(dialog).getByRole("link", { name: "Create again" })).toHaveAttribute(
      "href",
      "/budgets/new?from=b1",
    );
    expect(within(dialog).getByRole("link", { name: "Open Treats" })).toHaveAttribute(
      "href",
      "/budgets/b2",
    );
  });
});
