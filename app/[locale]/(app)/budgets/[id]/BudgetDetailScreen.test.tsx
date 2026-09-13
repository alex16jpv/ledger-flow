import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui/Toast";
import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import type { OutboxOperation } from "@/lib/local/schema";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";
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

// The six-period card reads the budget once per period, so the route has to move with `reference`.
const HISTORY_SPENT = [268_000, 212_000, 241_000, 305_000, 276_000];

// COP is UTC-5, so the month a reference falls in is read on the period's own clock, not UTC.
const OFFSET_MS = 5 * 60 * 60 * 1000;

function periodOf(budget: Budget, reference: string | null): Budget {
  if (!reference || budget.periodType !== "MONTHLY") return budget;
  const at = new Date(Date.parse(reference) - OFFSET_MS);
  if (Number.isNaN(at.getTime())) return budget;
  const start = new Date(Date.parse(budget.periodFrom) - OFFSET_MS);
  const back =
    (start.getUTCFullYear() - at.getUTCFullYear()) * 12 + (start.getUTCMonth() - at.getUTCMonth());
  if (back <= 0) return budget;
  const from = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1) + OFFSET_MS;
  const to = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1) + OFFSET_MS;
  return {
    ...budget,
    periodKey: new Date(from).toISOString().slice(0, 7),
    periodFrom: new Date(from).toISOString(),
    periodTo: new Date(to).toISOString(),
    amount: budget.baseAmount,
    hasOverride: false,
    spent: HISTORY_SPENT.at(-back) ?? 0,
  };
}

const spending = (buckets: { key: string; total: number; count: number }[]) =>
  json({
    groupBy: "day",
    total: buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    buckets: buckets.map((bucket) => ({ ...bucket, avg: bucket.total / bucket.count })),
  });

function routeFetch(budget: Budget, onMutation?: (url: string, init: RequestInit) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (method !== "GET" && onMutation) return Promise.resolve(onMutation(url, init ?? {}));
    if (url.includes("/api/stats/spending"))
      return Promise.resolve(
        url.includes("groupBy=category")
          ? json({
              groupBy: "category",
              total: 356_000,
              buckets: [
                { key: "lifestyle", total: 260_000, count: 4, avg: 65_000 },
                { key: "vacation", total: 96_000, count: 2, avg: 48_000 },
              ],
            })
          : spending([
              { key: "2026-09-09", total: 98_000, count: 1 },
              { key: "2026-09-21", total: 48_000, count: 1 },
              { key: "2026-09-22", total: 210_000, count: 3 },
            ]),
      );
    if (url.startsWith("/api/budgets/"))
      return Promise.resolve(
        json(periodOf(budget, new URL(url, "http://t").searchParams.get("reference"))),
      );
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

// Fake timers keep advancing: the reference is "now", so its exact instant is not asserted.
const anonymizeReference = (url: string) => url.replace(/reference=[^&]+/, "reference=<now>");

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

afterEach(async () => {
  vi.unstubAllGlobals();
  resetOutboxStatus();
  await wipeVaults();
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
    // F-08: the pace mark can be asked what it marks, and only here the answer stays on screen.
    expect(screen.getByRole("button", { name: /Day 22 of 30/ })).toBeInTheDocument();
    expect(
      screen.getByText(/The mark is today’s pace: \d+% of the period has passed \(day 22 of 30\)/),
    ).toBeVisible();
    expect(
      screen.getByText(
        "September 2026 is adjusted to $300,000. Other periods keep the base amount.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("base $250,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove adjustment" })).toBeInTheDocument();
    const chips = await screen.findByRole("group", { name: "Categories" });
    const vacation = within(chips).getByRole("button", { name: /Vacation/ });
    expect(within(vacation).getByText("archived")).toBeInTheDocument();
    expect(screen.getByText("Clothes, going out and treats.")).toBeInTheDocument();
    const period = screen.getByRole("region", { name: "Transactions this period" });
    expect(within(period).getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/transactions?period=custom&from=2026-09-01&to=2026-09-30&type=EXPENSE",
    );
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/budgets/b1/edit");
  });

  // T-30: the four cards of "what the period is doing", against a period that is 22 days in.
  it("says how the period got here and where it ends at this rate", async () => {
    routeFetch(lifestyle);
    renderScreen();

    const day = await screen.findByRole("group", { name: "Spending per day" });
    expect(within(day).getByRole("button", { name: /Sep 9 · \$98,000/ })).toBeInTheDocument();
    // A day that has not arrived is not a control: the period has 30 days and 22 have passed.
    expect(within(day).getAllByRole("button")).toHaveLength(22);

    // The figure is split by the marks that paint it, so the sentence is read whole.
    expect(
      screen.getByText((_, node) =>
        node?.textContent ===
        "At this rate you finish the period at $485,455 — $185,455 over the limit."
          ? node.className.includes("text-sm")
          : false,
      ),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: /where it ends at this rate/ })).toBeInTheDocument();
    expect(screen.getByText("Where it ends")).toBeVisible();

    const history = await screen.findByRole("group", {
      name: "Spent against the limit, period by period",
    });
    expect(within(history).getAllByRole("button")).toHaveLength(6);
    expect(
      within(history).getByRole("button", { name: "August 2026 · $276,000 of $250,000" }),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole("button", {
        name: "September 2026 · $356,000 of $300,000, in progress",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3 of the 5 finished periods went over. This one already has."),
    ).toBeVisible();
  });

  it("splits a budget of several categories and opens the day it is asked about", async () => {
    routeFetch(lifestyle);
    renderScreen();

    const breakdown = await screen.findByRole("region", { name: "Where it went" });
    expect(within(breakdown).getByText("$356,000 of $300,000")).toBeInTheDocument();
    expect(within(breakdown).getByRole("button", { name: /Lifestyle/ })).toHaveTextContent(
      "$260,000",
    );

    const day = await screen.findByRole("group", { name: "Spending per day" });
    await userEvent.click(within(day).getByRole("button", { name: /Sep 9 · \$98,000/ }));
    // Several categories are more than the Transactions filter can carry, so the day opens unnarrowed.
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: { period: "custom", from: "2026-09-09", to: "2026-09-09", type: "EXPENSE" },
    });
  });

  it("neither compares a first period nor projects from a single day", async () => {
    const first = {
      ...lifestyle,
      categoryIds: ["lifestyle"],
      archivedCategoryIds: [],
      effectiveFrom: "2026-09-01T05:00:00.000Z",
    };
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.includes("/api/stats/spending"))
        return Promise.resolve(spending([{ key: "2026-09-01", total: 12_400, count: 1 }]));
      if (url.startsWith("/api/budgets/")) return Promise.resolve(json(first));
      return Promise.resolve(empty());
    });
    vi.setSystemTime(new Date("2026-09-01T15:00:00.000Z"));
    renderScreen();

    expect(
      await screen.findByText(
        "It’s day 1 of the period: one day of spending says nothing about where it ends.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole("group", { name: "Spent against the limit, period by period" }),
      ).not.toBeInTheDocument();
    });
    // One category repeats the total, so the breakdown is absent too.
    expect(screen.queryByRole("region", { name: "Where it went" })).not.toBeInTheDocument();
    vi.setSystemTime(new Date("2026-09-22T15:00:00.000Z"));
  });

  // The owner's decision of 2026-09-13: a period that is over is the one worth looking back at.
  it("keeps the four cards on an archived budget and on one whose period ended", async () => {
    routeFetch({ ...lifestyle, archivedAt: "2026-09-10T00:00:00Z" });
    const archived = renderWithProviders(
      <QueryProvider>
        <ToastProvider>
          <BudgetDetailScreen id="b1" />
        </ToastProvider>
      </QueryProvider>,
    );
    expect(await screen.findByRole("group", { name: "Spending per day" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Biggest this period" })).toBeVisible();
    archived.unmount();

    routeFetch({ ...lifestyle, periodType: "CUSTOM", expired: true });
    renderScreen();
    expect(await screen.findByRole("group", { name: "Spending per day" })).toBeVisible();
  });

  // A CUSTOM window never repeats, so there is no earlier period to read or to draw.
  it("neither reads nor draws a history for a budget whose window never repeats", async () => {
    routeFetch({ ...lifestyle, periodType: "CUSTOM" });
    renderScreen();
    await screen.findByRole("group", { name: "Spending per day" });
    await waitFor(() => {
      expect(
        screen.queryByRole("group", { name: "Spent against the limit, period by period" }),
      ).not.toBeInTheDocument();
    });
    const earlier = fetchMock.mock.calls
      .map(([input]) => new URL(urlOf(input), "http://t"))
      .filter((url) => url.pathname.startsWith("/api/budgets/"))
      .map((url) => url.searchParams.get("reference") ?? "")
      .filter((reference) => Date.parse(reference) < Date.parse(lifestyle.periodFrom));
    expect(earlier).toEqual([]);
  });

  // A global budget is every expense of the period, so a breakdown would repeat its own total.
  it("leaves the breakdown out of a global budget and out of a single-category one", async () => {
    routeFetch({ ...lifestyle, categoryIds: [], archivedCategoryIds: [] });
    renderScreen();
    await screen.findByRole("group", { name: "Spending per day" });
    expect(screen.queryByRole("region", { name: "Where it went" })).not.toBeInTheDocument();
    const byCategory = fetchMock.mock.calls
      .map(([input]) => urlOf(input))
      .filter((url) => url.includes("groupBy=category"));
    expect(byCategory).toEqual([]);
  });

  // Without the lifetime guard the card would draw periods the budget did not live through.
  it("stops the walk at the period the budget began in", async () => {
    routeFetch({ ...lifestyle, effectiveFrom: "2026-07-01T05:00:00.000Z" });
    renderScreen();
    const history = await screen.findByRole("group", {
      name: "Spent against the limit, period by period",
    });
    // July, August and September: June ends before the budget existed, so it is not a period of it.
    await waitFor(() => {
      expect(within(history).getAllByRole("button")).toHaveLength(3);
    });
    expect(within(history).getByRole("button", { name: /^July 2026 · / })).toBeInTheDocument();
  });

  // Invariant 2: a chart drawn from an unsent write is marked, exactly like a number.
  it("marks all three charts as projections while a movement is still queued", async () => {
    routeFetch(lifestyle);
    // fake-indexeddb commits its transactions on real time; the frozen clock comes back after.
    vi.useRealTimers();
    const vault = await openTestVault("u-projected");
    const queued: OutboxOperation = {
      seq: 1,
      opId: "op-1",
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "create",
      occurredAt: "2026-09-22T10:00:00.000Z",
      payload: {},
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    };
    await vault.db.put("outbox", queued);
    await refreshOutboxStatus(vault.db);
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-22T15:00:00.000Z") });

    renderScreen();

    // The mark belongs to each chart, not to the screen: it is looked for inside its own wrapper.
    const marked = (chart: HTMLElement) =>
      chart
        .closest("span.inline-flex")
        ?.querySelector('[aria-label="Includes changes not yet synced"]') ?? null;

    await screen.findByRole("group", { name: "Spending per day" });
    await waitFor(() => {
      expect(marked(screen.getByRole("group", { name: "Spending per day" }))).not.toBeNull();
    });
    expect(marked(screen.getByRole("img", { name: /against the period’s pace/ }))).not.toBeNull();
    expect(
      marked(screen.getByRole("group", { name: "Spent against the limit, period by period" })),
    ).not.toBeNull();
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

    expect(calls.map((call) => [call.method, anonymizeReference(call.url), call.body])).toEqual([
      ["PUT", "/api/budgets/b1/amount?reference=<now>", { amount: 400_000 }],
      ["PUT", "/api/budgets/b1/amount?reference=<now>", { amount: 0 }],
      ["DELETE", "/api/budgets/b1/amount?reference=<now>", null],
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
    expect(calls.map(anonymizeReference)).toEqual(["POST /api/budgets/b1/restore?reference=<now>"]);
  });

  it("refuses an overlapping restore and names the budget in the way", async () => {
    const other = { ...lifestyle, id: "b2", name: "Treats", archivedAt: null };
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (init?.method === "POST")
        return Promise.resolve(
          json({ code: "BUDGET_PERIOD_OVERLAP", message: "overlap" }, { status: 400 }),
        );
      if (url.includes("/api/stats/spending")) return Promise.resolve(spending([]));
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
