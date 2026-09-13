import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { dayViewStore } from "@/lib/charts/day-view";
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
  Link: ({
    href,
    ...rest
  }: { href: { query: Record<string, string> } } & Omit<ComponentProps<"a">, "href">) => (
    <a href={`/transactions?${new URLSearchParams(href.query).toString()}`} {...rest} />
  ),
}));

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });
const fetchMock = vi.fn<typeof fetch>();
const biggestUrls: URL[] = [];
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
    if (url.pathname.startsWith("/api/accounts"))
      return Promise.resolve(
        empty([
          {
            id: "visa",
            name: "Visa Gold",
            type: "CARD",
            color: "PURPLE",
            balance: 0,
            openingBalance: 0,
            userId: "u",
            isDefault: true,
            currency: "COP",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "cash",
            name: "Cash",
            type: "CASH",
            color: "GRAY",
            balance: 0,
            openingBalance: 0,
            userId: "u",
            isDefault: false,
            currency: "COP",
            archivedAt: null,
            createdAt: "",
            updatedAt: "",
          },
        ]),
      );
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
    if (url.pathname === "/api/transactions" && url.searchParams.get("sort") === "amount") {
      biggestUrls.push(url);
      return Promise.resolve(
        empty([
          {
            id: "t1",
            type: "EXPENSE",
            amount: 98_000,
            date: "2026-09-09T18:00:00.000Z",
            dayKey: "2026-09-09",
            description: "Zara",
            note: null,
            categoryId: "lifestyle",
            fromAccountId: "visa",
            toAccountId: null,
            tags: [],
            source: "FORM",
            pendingDetails: false,
            userId: "u",
            createdAt: "",
            updatedAt: "",
          },
        ]),
      );
    }
    return Promise.resolve(empty());
  });
}

function renderScreen(query = "", timeZone = "America/Bogota") {
  search = query;
  renderWithProviders(
    <QueryProvider>
      <StatsScreen />
    </QueryProvider>,
    { timeZone },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  biggestUrls.length = 0;
  window.localStorage.clear();
  dayViewStore.reset();
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
    expect(bars).toHaveLength(22);
    expect(screen.getByText("Priciest day")).toBeInTheDocument();
    expect(screen.getByText("No-spend days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Wednesday 9 · highest/ })).toBeInTheDocument();
    expect(screen.getByText("Highest day · Wednesday, September 9")).toBeInTheDocument();
    const [, , , , , , , , ninth] = bars as HTMLElement[] & { 8: HTMLElement };
    expect(ninth).toHaveAccessibleName("Wed, Sep 9 · $214,000");
    await userEvent.click(ninth);
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: { period: "custom", from: "2026-09-09", to: "2026-09-09", type: "EXPENSE" },
    });
  });

  it("asks for the highest day in the user's zone, not around noon UTC", async () => {
    routeFetch();
    renderScreen("groupBy=day", "Pacific/Kiritimati");
    await screen.findByRole("group", { name: "Per day" });
    const listed = fetchMock.mock.calls
      .map((call) => new URL(urlOf(call[0]), "http://localhost"))
      .find(
        (url) =>
          url.pathname === "/api/transactions" &&
          url.searchParams.has("from") &&
          !url.searchParams.has("sort"),
      );
    expect(listed?.searchParams.get("from")).toBe("2026-09-08T10:00:00.000Z");
    expect(listed?.searchParams.get("to")).toBe("2026-09-09T10:00:00.000Z");
  });

  it("reads the same days as a calendar, and remembers which one was chosen", async () => {
    routeFetch();
    renderScreen("groupBy=day");
    expect(await screen.findByRole("group", { name: "Per day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wed, Sep 9 · $214,000" })).toHaveTextContent("");
    await userEvent.click(screen.getByRole("button", { name: "Calendar" }));
    const cell = screen.getByRole("button", { name: "Wed, Sep 9 · $214,000" });
    expect(cell).toHaveTextContent("9");
    expect(window.localStorage.getItem("lf.dayView")).toBe("calendar");
    await userEvent.click(cell);
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: { period: "custom", from: "2026-09-09", to: "2026-09-09", type: "EXPENSE" },
    });
  });

  it("averages the days of each weekday and names the most expensive one", async () => {
    routeFetch();
    renderScreen("groupBy=day");
    // By the 22nd three Wednesdays have gone: $12,500 on the 2nd, $214,000 on the 9th, nothing on the 16th.
    const chart = await screen.findByRole("img", { name: /Average by weekday/ });
    expect(chart).toHaveAccessibleName(expect.stringContaining("Wednesday · $75,500 on average"));
    expect(screen.getByText("Wednesday is your most expensive day")).toBeInTheDocument();
    expect(within(chart).queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks the server for the five biggest and lists them with the day they fell on", async () => {
    routeFetch();
    renderScreen("groupBy=day");
    expect(await screen.findByRole("heading", { name: "Biggest this period" })).toBeInTheDocument();
    const [asked] = biggestUrls;
    expect(asked?.searchParams.get("order")).toBe("desc");
    expect(asked?.searchParams.get("limit")).toBe("5");
    expect(asked?.searchParams.get("from")).toBe("2026-09-01T05:00:00.000Z");
    const row = screen.getByRole("button", { name: /Zara/ });
    expect(row).toHaveTextContent("Wed, Sep 9");
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
