import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryProvider } from "@/lib/query/QueryProvider";
import { renderWithProviders } from "@/lib/testing/render";

import { StatsScreen } from "./StatsScreen";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace }),
  usePathname: () => "/stats",
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-09-22T15:00:00.000Z") });

const empty = (data: unknown[] = []) =>
  json({
    data,
    pagination: { limit: 30, offset: 0, total: data.length, hasMore: false, nextCursor: null },
  });

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

const categoryBuckets = [
  { key: "food", total: 412_000, count: 24, avg: 17_166 },
  { key: "uncategorized", total: 47_900, count: 3, avg: 15_966 },
  { key: "lifestyle", total: 356_000, count: 11, avg: 32_363 },
];

function routeFetch() {
  fetchMock.mockImplementation((input) => {
    const url = new URL(urlOf(input), "http://localhost");
    if (url.pathname === "/api/stats/spending") {
      const groupBy = url.searchParams.get("groupBy");
      if (groupBy === "day")
        return Promise.resolve(
          json({
            groupBy,
            total: 815_900,
            buckets: [
              { key: "2026-09-09", total: 214_000, count: 3, avg: 71_333 },
              { key: "2026-09-02", total: 12_500, count: 1, avg: 12_500 },
            ],
          }),
        );
      if (groupBy === "tag")
        return Promise.resolve(
          json({
            groupBy,
            total: 815_900,
            buckets: [
              { key: "latte", total: 286_400, count: 41, avg: 6_985 },
              { key: "untagged", total: 500_000, count: 10, avg: 50_000 },
            ],
          }),
        );
      return Promise.resolve(
        json({ groupBy: "category", total: 815_900, buckets: categoryBuckets }),
      );
    }
    if (url.pathname.startsWith("/api/categories"))
      return Promise.resolve(
        empty([
          {
            id: "food",
            name: "Food",
            icon: "utensils",
            color: "ORANGE",
            type: "EXPENSE",
            userId: "u",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "lifestyle",
            name: "Lifestyle",
            icon: "shopping-bag",
            color: "PURPLE",
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

function renderScreen(query = "") {
  search = query;
  renderWithProviders(
    <QueryProvider>
      <StatsScreen />
    </QueryProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  replace.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StatsScreen", () => {
  it("shows the total, the shares by category and opens the filtered list on tap", async () => {
    routeFetch();
    renderScreen();
    expect(await screen.findByText("Total spent")).toBeInTheDocument();
    expect(screen.getByText("38 transactions · average $21,471")).toBeInTheDocument();
    const rows = screen.getAllByRole("button", { name: /Food|Lifestyle|Uncategorized/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Food"),
      expect.stringContaining("Lifestyle"),
      expect.stringContaining("Uncategorized"),
    ]);
    const [foodRow, lifestyleRow, uncategorizedRow] = rows as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(within(foodRow).getByText("50 %")).toBeInTheDocument();
    expect(within(foodRow).getByText("24 txns")).toBeInTheDocument();
    expect(within(lifestyleRow).getByText("archived")).toBeInTheDocument();
    await userEvent.click(uncategorizedRow);
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: {
        period: "custom",
        from: "2026-09-01",
        to: "2026-09-30",
        type: "EXPENSE",
        uncategorized: "1",
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Income" }));
    expect(replace).toHaveBeenCalledWith({ pathname: "/stats", query: { type: "INCOME" } });
  });

  it("draws every day of the month, the day stats and drills into the tapped day", async () => {
    routeFetch();
    renderScreen("groupBy=day");
    const chart = await screen.findByRole("group", { name: "Per day" });
    const bars = within(chart).getAllByRole("button");
    expect(bars).toHaveLength(30);
    expect(screen.getByText("Priciest day")).toBeInTheDocument();
    expect(screen.getByText("No-spend days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Wednesday 9 · highest/ })).toBeInTheDocument();
    const [, , , , , , , , ninth] = bars as HTMLElement[] & { 8: HTMLElement };
    await userEvent.click(ninth);
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: { period: "custom", from: "2026-09-09", to: "2026-09-09", type: "EXPENSE" },
    });
  });

  it("warns about double counting and lists the tags without the untagged bucket", async () => {
    routeFetch();
    renderScreen("groupBy=tag");
    expect(await screen.findByText(/counts in each of them/)).toBeInTheDocument();
    expect(screen.getByText(/\$500,000 has no tags/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /#latte/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /untagged/ })).not.toBeInTheDocument();
  });
});
