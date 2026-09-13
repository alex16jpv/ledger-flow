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
  }: {
    href: { pathname: string; query: Record<string, string> };
  } & Omit<ComponentProps<"a">, "href">) => {
    const query = new URLSearchParams(href.query).toString();
    return <a href={query ? `${href.pathname}?${query}` : href.pathname} {...rest} />;
  },
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
      if (groupBy === "account")
        return Promise.resolve(
          json({
            groupBy,
            total: 815_900,
            buckets: [
              { key: "visa", total: 612_400, count: 27, avg: 22_681 },
              { key: "cash", total: 140_000, count: 8, avg: 17_500 },
              { key: "nu", total: 60_000, count: 2, avg: 30_000 },
              { key: "unassigned", total: 3_500, count: 1, avg: 3_500 },
              { key: "ghost", total: 0, count: 1, avg: 0 },
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
            id: "nu",
            name: "Nu (old card)",
            type: "CARD",
            color: "GRAY",
            balance: 0,
            openingBalance: 0,
            userId: "u",
            isDefault: false,
            currency: "COP",
            archivedAt: "2026-08-01T00:00:00Z",
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
  renderScreenWith(query, timeZone);
}

function renderScreenWith(query = "", timeZone = "America/Bogota") {
  search = query;
  return renderWithProviders(
    <QueryProvider>
      <StatsScreen />
    </QueryProvider>,
    { timeZone },
  );
}

const NOW = new Date("2026-09-22T15:00:00.000Z");

beforeEach(() => {
  // Rule 22: a test that moves the clock must not decide what the next one reads.
  vi.setSystemTime(NOW);
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

  it("draws a weekday no day has reached as a rule, and refuses to call a future day the priciest", async () => {
    vi.setSystemTime(new Date("2026-09-02T15:00:00.000Z"));
    routeFetch();
    renderScreen("groupBy=day");
    // September 2026 opens on a Tuesday, so by the 2nd only Tuesday and Wednesday have happened.
    const week = await screen.findByRole("img", { name: /^Average by weekday/ });
    expect(week).toHaveAccessibleName(expect.stringContaining("Tuesday"));
    expect(week).toHaveAccessibleName(expect.stringContaining("Wednesday"));
    expect(week).not.toHaveAccessibleName(expect.stringContaining("Friday"));
    // The 9th is the biggest bucket but has not arrived, so the priciest day is the 2nd.
    expect(screen.getByText("Highest day · Wednesday, September 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wednesday 2 · highest" })).toBeInTheDocument();
  });

  it("dates a biggest movement by the day it froze, not by the device's reading of the instant", async () => {
    routeFetch();
    renderScreen("groupBy=day", "Pacific/Kiritimati");
    await screen.findByRole("heading", { name: "Biggest this period" });
    // 2026-09-09T18:00Z is already the 10th in Kiritimati; the row froze on the 9th and says so.
    expect(screen.getByRole("button", { name: /Zara/ })).toHaveTextContent("Wed, Sep 9");
  });

  it("splits the month by account, says transfers are not spending, and filters by the account", async () => {
    routeFetch();
    renderScreen("groupBy=account");
    const visa = await screen.findByRole("button", { name: /^Visa Gold/ });
    expect(within(visa).getByText("75 %")).toBeInTheDocument();
    expect(within(visa).getByText("27 txns")).toBeInTheDocument();
    expect(
      screen.getByText(/Transfers between your own accounts are not spending/),
    ).toBeInTheDocument();
    await userEvent.click(visa);
    expect(push).toHaveBeenCalledWith({
      pathname: "/transactions",
      query: {
        period: "custom",
        from: "2026-09-01",
        to: "2026-09-30",
        type: "EXPENSE",
        account: "visa",
      },
    });
  });

  it("names the bucket with no account, badges an archived one, and resolves an unknown id", async () => {
    routeFetch();
    renderScreen("groupBy=account");
    await screen.findByRole("button", { name: /^Visa Gold/ });
    const archived = screen.getByRole("button", { name: /^Nu \(old card\)/ });
    expect(within(archived).getByText("archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unknown account/ })).toBeInTheDocument();
    // No filter narrows it, so it is a figure and never a way into a list that is not its own.
    expect(screen.queryByRole("button", { name: /^No account/ })).toBeNull();
    const list = screen.getByRole("button", { name: /^Visa Gold/ }).parentElement ?? document.body;
    const row = within(list).getByText("No account").closest("div.w-full");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("3,500");
    expect(row?.textContent).toContain("1 txn");
    expect(screen.getByRole("img", { name: /^Share by account: / })).toHaveAccessibleName(
      expect.stringContaining("No account 0 %"),
    );
  });

  it("keeps the transfers line out of every reading it would be false in", async () => {
    routeFetch();
    renderScreen("groupBy=account");
    await screen.findByRole("button", { name: /^Visa Gold/ });
    expect(
      screen.getByText(/Transfers between your own accounts are not spending/),
    ).toBeInTheDocument();
    renderScreen("groupBy=account&type=TRANSFER");
    await screen.findAllByRole("button", { name: /^Visa Gold/ });
    expect(
      screen.queryAllByText(/Transfers between your own accounts are not spending/),
    ).toHaveLength(1);
  });

  it("draws the account view with the icon of each account's type", async () => {
    routeFetch();
    const { container } = renderScreenWith("groupBy=account");
    await screen.findByRole("button", { name: /^Visa Gold/ });
    const visa = screen.getByRole("button", { name: /^Visa Gold/ });
    expect(visa.querySelector(".lucide-credit-card")).not.toBeNull();
    const cash = screen.getByRole("button", { name: /^Cash/ });
    expect(cash.querySelector(".lucide-banknote")).not.toBeNull();
    expect(container.querySelectorAll(".lucide-wallet").length).toBeGreaterThan(0);
  });

  it("lets the biggest movements fail on their own without blanking the screen", async () => {
    routeFetch();
    const routed = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      const url = new URL(urlOf(input), "http://localhost");
      if (url.pathname === "/api/transactions" && url.searchParams.get("sort") === "amount") {
        return Promise.resolve(json({ code: "DB_UNAVAILABLE", message: "no" }, { status: 503 }));
      }
      return routed?.(input, init) ?? Promise.resolve(empty());
    });
    renderScreen("groupBy=account");
    expect(
      await screen.findByText("We couldn\u2019t load the biggest movements"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Visa Gold/ })).toBeInTheDocument();
  });

  it("warns about double counting and lists the tags without the untagged bucket", async () => {
    routeFetch();
    renderScreen("groupBy=tag");
    expect(await screen.findByText(/counts in each of them/)).toBeInTheDocument();
    expect(screen.getByText(/\$500,000 has no tags/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /#latte/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /untagged/ })).not.toBeInTheDocument();
  });

  it.each(["", "groupBy=day", "groupBy=account", "groupBy=tag"])(
    "ends the %s view with the way into Trends",
    async (query) => {
      routeFetch();
      renderScreen(query);
      const link = await screen.findByRole("link", { name: /Trends over time/ });
      expect(link).toHaveAttribute("href", "/stats/trends");
    },
  );

  it("offers Trends from an empty period too, which is when the question gets asked", async () => {
    fetchMock.mockImplementation((input) => {
      const url = new URL(urlOf(input), "http://localhost");
      if (url.pathname === "/api/stats/spending")
        return Promise.resolve(json({ groupBy: "category", total: 0, buckets: [] }));
      return Promise.resolve(empty());
    });
    renderScreen();
    expect(await screen.findByText("Nothing recorded in this period")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trends over time/ })).toHaveAttribute(
      "href",
      "/stats/trends",
    );
  });

  it("takes the month being read into Trends, and only when it is not this one", async () => {
    routeFetch();
    renderScreen("reference=2026-07");
    const link = await screen.findByRole("link", { name: /Trends over time/ });
    expect(link).toHaveAttribute("href", "/stats/trends?reference=2026-07");
  });
});
