import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";
import type { Budget } from "@/types/api";

import { BudgetsView } from "./BudgetsView";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const now = new Date("2026-09-22T15:00:00.000Z");

function budget(id: string, name: string, extra: Partial<Budget> = {}): Budget {
  return {
    id,
    name,
    color: "ORANGE",
    categoryIds: ["food"],
    archivedCategoryIds: [],
    type: "EXPENSE",
    currency: "COP",
    periodType: "MONTHLY",
    periodKey: "2026-09",
    periodFrom: "2026-09-01T05:00:00.000Z",
    periodTo: "2026-10-01T05:00:00.000Z",
    baseAmount: 600_000,
    amount: 600_000,
    spent: 412_000,
    hasOverride: false,
    expired: false,
    effectiveFrom: "2026-01-01T05:00:00.000Z",
    note: null,
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const budgets = [
  budget("global", "Total monthly budget", {
    categoryIds: [],
    color: "INDIGO",
    amount: 2_000_000,
    baseAmount: 2_000_000,
    spent: 1_284_300,
  }),
  budget("food", "Food"),
  budget("lifestyle", "Lifestyle", {
    categoryIds: ["lifestyle"],
    amount: 300_000,
    baseAmount: 250_000,
    spent: 356_000,
    hasOverride: true,
  }),
  budget("coffee", "Coffee", {
    categoryIds: ["coffee"],
    periodType: "WEEKLY",
    periodFrom: "2026-09-21T05:00:00.000Z",
    periodTo: "2026-09-28T05:00:00.000Z",
    amount: 80_000,
    baseAmount: 80_000,
    spent: 38_000,
  }),
  budget("trip", "Old trip", {
    categoryIds: ["trip"],
    periodType: "CUSTOM",
    periodFrom: "2026-11-02T05:00:00.000Z",
    periodTo: "2026-11-04T05:00:00.000Z",
    amount: 100_000,
    baseAmount: 100_000,
    spent: 0,
  }),
  budget("vacation", "Vacation", {
    categoryIds: ["vacation"],
    archivedCategoryIds: ["vacation"],
    periodType: "CUSTOM",
    periodFrom: "2026-09-15T05:00:00.000Z",
    periodTo: "2026-10-16T05:00:00.000Z",
    amount: 2_500_000,
    baseAmount: 2_500_000,
    spent: 1_850_000,
  }),
];

const list = (data: Budget[]) =>
  json({
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderView(props: Partial<Parameters<typeof BudgetsView>[0]> = {}) {
  const onMonthChange = vi.fn();
  const onPeriodFilterChange = vi.fn();
  const onCreateGlobal = vi.fn();
  renderWithProviders(
    <QueryProvider>
      <BudgetsView
        monthKey="2026-09"
        periodFilter={null}
        categories={new Map()}
        now={now}
        onMonthChange={onMonthChange}
        onPeriodFilterChange={onPeriodFilterChange}
        onCreateGlobal={onCreateGlobal}
        {...props}
      />
    </QueryProvider>,
  );
  return { onMonthChange, onPeriodFilterChange, onCreateGlobal };
}

describe("BudgetsView", () => {
  it("features the global budget, phrases each status and navigates months", async () => {
    fetchMock.mockResolvedValue(list(budgets));
    const { onMonthChange } = renderView();
    expect(await screen.findByText("Global")).toBeInTheDocument();
    expect(screen.getByText("$715,700 left for 9 days")).toBeInTheDocument();
    expect(screen.getByText("≈ $79,522/day")).toBeInTheDocument();
    const url = fetchMock.mock.calls[0]?.[0];
    expect(url).toContain("reference=2026-09-22T15%3A00%3A00.000Z");

    expect(screen.getByText("$188,000 left · 9 days left")).toBeInTheDocument();
    expect(screen.getByText("Over by $56,000")).toBeInTheDocument();
    expect(screen.getByText("Adjusted")).toBeInTheDocument();
    expect(screen.getByText("Archived category")).toBeInTheDocument();
    expect(screen.getByText("ends in 24 days")).toBeInTheDocument();
    expect(screen.getByText("$650,000 left · ends in 24 days")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Old trip" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Food" })).toHaveAttribute(
      "href",
      "/budgets/food?reference=2026-09",
    );
    expect(screen.getByText(/never count toward a budget/)).toBeInTheDocument();
    // F-08: the mark answers on the global card too, but the legend under it belongs to the detail
    // alone — here it would be noise on every card.
    expect(screen.getByRole("button", { name: /Day \d+ of 30/ })).toBeInTheDocument();
    expect(screen.queryByText(/The mark is today’s pace/)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-08");
  });

  it("filters by period type on the client", async () => {
    fetchMock.mockResolvedValue(list(budgets.filter((row) => row.id !== "global")));
    const { onPeriodFilterChange } = renderView({ periodFilter: "WEEKLY" });
    expect(await screen.findByRole("link", { name: "Coffee" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Food" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create a total monthly budget/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(onPeriodFilterChange).toHaveBeenCalledWith("MONTHLY");
  });

  it("offers the global CTA when the current month has no global budget", async () => {
    fetchMock.mockResolvedValue(list(budgets.filter((row) => row.id !== "global")));
    const { onCreateGlobal } = renderView();
    await userEvent.click(
      await screen.findByRole("button", { name: /Create a total monthly budget/ }),
    );
    expect(onCreateGlobal).toHaveBeenCalled();
  });

  it("shows the empty state with its CTA when the month has no budgets", async () => {
    fetchMock.mockResolvedValue(list([]));
    const { onCreateGlobal } = renderView();
    expect(
      await screen.findByRole("heading", { name: "Put a ceiling on your small spending" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create a monthly budget" }));
    expect(onCreateGlobal).toHaveBeenCalled();
  });

  it("offers a retry when the list fails", async () => {
    fetchMock.mockResolvedValue(json({ code: "DB_UNAVAILABLE", message: "down" }, { status: 503 }));
    renderView();
    // React Query retries once with a backoff before the error state renders.
    expect(
      await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
