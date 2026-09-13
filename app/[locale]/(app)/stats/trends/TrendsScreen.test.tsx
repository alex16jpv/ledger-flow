import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { refreshOutboxStatus, resetOutboxStatus } from "@/lib/local/outbox";
import type { OutboxOperation } from "@/lib/local/schema";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { TrendsScreen } from "./TrendsScreen";

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back, replace }),
  usePathname: () => "/stats/trends",
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-22T15:00:00.000Z") });

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

const at = (key: string, total: number) => ({ key, total, count: 1, avg: total });

const INCOME_MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map(
  (key) => at(key, 4_200_000),
);
const SPENDING_MONTHS = [
  at("2026-04", 1_980_000),
  at("2026-05", 2_240_000),
  at("2026-06", 1_680_000),
  at("2026-07", 2_110_000),
  at("2026-08", 1_855_000),
  at("2026-09", 815_900),
];
const RANKING = [
  at("food", 4_000_000),
  at("bills", 2_000_000),
  at("transport", 1_500_000),
  at("coffee", 1_000_000),
  at("lifestyle", 900_000),
  at("uncategorized", 280_900),
];

interface Fixture {
  incomeMonths?: typeof INCOME_MONTHS;
  spendingMonths?: typeof SPENDING_MONTHS;
  fails?: "mix" | "months" | "days";
}

function routeFetch({ incomeMonths, spendingMonths, fails }: Fixture = {}) {
  const income = incomeMonths ?? INCOME_MONTHS;
  const spending = spendingMonths ?? SPENDING_MONTHS;
  const sum = (buckets: { total: number }[]) =>
    buckets.reduce((total, entry) => total + entry.total, 0);
  const boom = json({ code: "INTERNAL", message: "no" }, { status: 503 });
  fetchMock.mockImplementation((input) => {
    const url = new URL(urlOf(input), "http://localhost");
    if (url.pathname === "/api/stats/spending") {
      const groupBy = url.searchParams.get("groupBy");
      const type = url.searchParams.get("type");
      const splitBy = url.searchParams.get("splitBy");
      if (groupBy === "month" && splitBy === "category") {
        if (fails === "mix") return Promise.resolve(boom);
        return Promise.resolve(
          json({
            groupBy,
            splitBy,
            total: sum(spending),
            buckets: spending.map((month) => ({
              ...month,
              splits: [
                { key: "food", total: Math.round(month.total * 0.6), count: 1, avg: 0 },
                { key: "bills", total: Math.round(month.total * 0.2), count: 1, avg: 0 },
              ],
            })),
          }),
        );
      }
      if (groupBy === "month") {
        if (fails === "months") return Promise.resolve(boom);
        const buckets = type === "INCOME" ? income : spending;
        return Promise.resolve(json({ groupBy, splitBy: null, total: sum(buckets), buckets }));
      }
      if (groupBy === "day") {
        if (fails === "days") return Promise.resolve(boom);
        const september = url.searchParams.get("from")?.startsWith("2026-09") === true;
        const buckets = september
          ? [at("2026-09-01", 200_000), at("2026-09-09", 214_000)]
          : [at("2026-08-01", 300_000), at("2026-08-02", 128_000)];
        return Promise.resolve(json({ groupBy, splitBy: null, total: sum(buckets), buckets }));
      }
      return Promise.resolve(
        json({ groupBy: "category", splitBy: null, total: sum(RANKING), buckets: RANKING }),
      );
    }
    if (url.pathname.startsWith("/api/categories"))
      return Promise.resolve(
        json({
          data: [
            { id: "food", name: "Food", icon: "utensils", color: "ORANGE", type: "EXPENSE" },
            { id: "bills", name: "Bills", icon: "receipt", color: "AMBER", type: "EXPENSE" },
          ].map((category) => ({
            ...category,
            userId: "u",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          })),
          pagination: { limit: 30, offset: 0, total: 2, hasMore: false, nextCursor: null },
        }),
      );
    return Promise.resolve(json({ code: "NOT_FOUND", message: "no" }, { status: 404 }));
  });
}

function renderScreen(query = "") {
  search = query;
  return renderWithProviders(
    <QueryProvider>
      <TrendsScreen />
    </QueryProvider>,
    { timeZone: "America/Bogota" },
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-09-22T15:00:00.000Z"));
  fetchMock.mockReset();
  push.mockReset();
  replace.mockReset();
  back.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetOutboxStatus();
  await wipeVaults();
});

describe("TrendsScreen", () => {
  it("counts only the months that finished in the two tiles", async () => {
    routeFetch();
    renderScreen();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    // September is still running, so it is off both totals: 25,200,000 − 4,200,000 against 10,680,900 − 815,900.
    expect(screen.getByText("$11,135,000")).toBeInTheDocument();
    expect(screen.getByText("5 complete months")).toBeInTheDocument();
    expect(screen.getByText("53 %")).toBeInTheDocument();
  });

  it("draws the month still running as in progress and opens Stats for the month tapped", async () => {
    routeFetch();
    renderScreen();
    const chart = await screen.findByRole("group", {
      name: "Income against spending, month by month",
    });
    const slots = within(chart).getAllByRole("button");
    expect(slots.map((slot) => slot.getAttribute("aria-label"))).toEqual([
      "April 2026 · $4,200,000 in, $1,980,000 out",
      "May 2026 · $4,200,000 in, $2,240,000 out",
      "June 2026 · $4,200,000 in, $1,680,000 out",
      "July 2026 · $4,200,000 in, $2,110,000 out",
      "August 2026 · $4,200,000 in, $1,855,000 out",
      "September 2026 · $4,200,000 in, $815,900 out, in progress",
    ]);
    await userEvent.click(within(chart).getByRole("button", { name: /^April/ }));
    expect(push).toHaveBeenCalledWith({ pathname: "/stats", query: { reference: "2026-04" } });
  });

  it("compares this month with the same days of the last one", async () => {
    routeFetch();
    renderScreen();
    expect(await screen.findByText("This month against last")).toBeInTheDocument();
    // 414,000 against the 428,000 of the same 22 days of August.
    expect(screen.getByText(/3 % less/)).toBeInTheDocument();
    expect(screen.getByText("$414,000")).toBeInTheDocument();
    expect(screen.getByText("August 2026, same days")).toBeInTheDocument();
    expect(screen.getByText("Day 22")).toBeInTheDocument();
  });

  it("stacks the categories of each month and names what is left Other", async () => {
    routeFetch();
    renderScreen();
    const chart = await screen.findByRole("group", {
      name: "Spending per month, split by category",
    });
    expect(
      within(chart).getByRole("button", { name: "September 2026 · $815,900, in progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("says so when the range holds more months than this account has", async () => {
    routeFetch({
      incomeMonths: [at("2026-08", 4_200_000), at("2026-09", 4_200_000)],
      spendingMonths: [at("2026-08", 1_855_000), at("2026-09", 815_900)],
    });
    renderScreen();
    expect(await screen.findByText(/This account has 2 months of history/)).toBeInTheDocument();
    const chart = screen.getByRole("group", { name: "Income against spending, month by month" });
    expect(within(chart).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("1 complete month")).toBeInTheDocument();
  });

  it("draws nothing rather than a row of zeros when the range is empty", async () => {
    routeFetch({ incomeMonths: [], spendingMonths: [] });
    renderScreen();
    expect(await screen.findByText("Not enough history yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Income against spending, month by month" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Where it goes")).not.toBeInTheDocument();
  });

  it("replaces only the card that failed", async () => {
    routeFetch({ fails: "mix" });
    renderScreen();
    expect(await screen.findByText("We couldn’t load where your money went")).toBeInTheDocument();
    expect(screen.getByText("Income and spending")).toBeInTheDocument();
    expect(screen.getByText("This month against last")).toBeInTheDocument();
    expect(screen.getByText("$11,135,000")).toBeInTheDocument();
  });

  // Invariant 2: a chart drawn from an unsent write is marked, exactly like a number.
  it("marks all three charts as projections while a movement is still queued", async () => {
    routeFetch();
    // fake-indexeddb commits its transactions on real time; the frozen clock comes back after.
    vi.useRealTimers();
    const vault = await openTestVault("u-trends-projected");
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

    await screen.findByRole("group", { name: "Income against spending, month by month" });
    await waitFor(() => {
      expect(
        marked(screen.getByRole("group", { name: "Income against spending, month by month" })),
      ).not.toBeNull();
    });
    expect(
      marked(
        screen.getByRole("img", {
          name: "Spending so far this month against the same days of the previous month",
        }),
      ),
    ).not.toBeNull();
    expect(
      marked(screen.getByRole("group", { name: "Spending per month, split by category" })),
    ).not.toBeNull();
  });

  it("carries the range in the address so the screen can be shared and reloaded", async () => {
    routeFetch();
    renderScreen();
    await screen.findByText("Saved");
    await userEvent.click(screen.getByRole("button", { name: "Last 12 months" }));
    expect(replace).toHaveBeenCalledWith({
      pathname: "/stats/trends",
      query: { range: "12" },
    });
  });

  it("reads the range the address asks for", async () => {
    routeFetch();
    renderScreen("range=12&reference=2026-08");
    await screen.findByText("Saved");
    const windows = fetchMock.mock.calls
      .map(([input]) => new URL(urlOf(input), "http://localhost"))
      .filter((url) => url.searchParams.get("groupBy") === "month");
    expect(windows[0]?.searchParams.get("from")).toBe("2025-09-01T05:00:00.000Z");
    expect(windows[0]?.searchParams.get("to")).toBe("2026-09-01T05:00:00.000Z");
  });
});
