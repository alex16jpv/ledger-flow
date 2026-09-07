import {
  countActiveFilters,
  DEFAULT_FILTERS,
  matchesSearch,
  parseFilters,
  periodWindow,
  serializeFilters,
  toListQuery,
} from "./filters";

const BOGOTA = "America/Bogota";
const NOW = new Date("2026-09-22T20:00:00Z");

describe("transaction filters", () => {
  it("round-trips through the URL and drops defaults", () => {
    const filters = parseFilters(
      new URLSearchParams(
        "period=custom&from=2026-09-01&to=2026-09-15&type=EXPENSE&account=a1&tag=%23Latte&pending=1&source=QUICK&q=uber",
      ),
    );
    expect(filters).toMatchObject({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-15",
      type: "EXPENSE",
      accountId: "a1",
      tag: "#latte",
      pendingDetails: true,
      quickOnly: true,
      q: "uber",
    });
    expect(serializeFilters(filters).toString()).toBe(
      "period=custom&from=2026-09-01&to=2026-09-15&type=EXPENSE&account=a1&tag=%23latte&pending=1&source=QUICK&q=uber",
    );
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
    expect(parseFilters(new URLSearchParams("period=custom&type=BOGUS"))).toMatchObject({
      period: "month",
      type: null,
    });
  });

  it("counts the active filters the chip badge shows", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, period: "week", uncategorized: true, q: "x" }),
    ).toBe(2);
  });

  it("turns presets into half-open windows in the user's zone", () => {
    expect(periodWindow({ period: "month", from: null, to: null }, BOGOTA, NOW)).toEqual({
      from: new Date("2026-09-01T05:00:00Z"),
      to: new Date("2026-10-01T05:00:00Z"),
    });
    expect(periodWindow({ period: "week", from: null, to: null }, BOGOTA, NOW)?.from).toEqual(
      new Date("2026-09-21T05:00:00Z"),
    );
    expect(periodWindow({ period: "lastMonth", from: null, to: null }, BOGOTA, NOW)?.from).toEqual(
      new Date("2026-08-01T05:00:00Z"),
    );
    expect(
      periodWindow({ period: "custom", from: "2026-09-01", to: "2026-09-15" }, BOGOTA, NOW),
    ).toEqual({ from: new Date("2026-09-01T05:00:00Z"), to: new Date("2026-09-16T05:00:00Z") });
    expect(periodWindow({ period: "all", from: null, to: null }, BOGOTA, NOW)).toBeNull();
  });

  it("maps filters to the API query and lets uncategorized win over a category", () => {
    expect(
      toListQuery(
        { ...DEFAULT_FILTERS, categoryId: "c1", uncategorized: true, pendingDetails: true },
        BOGOTA,
        NOW,
      ),
    ).toMatchObject({
      from: "2026-09-01T05:00:00.000Z",
      to: "2026-10-01T05:00:00.000Z",
      categoryId: undefined,
      uncategorized: "true",
      pendingDetails: "true",
      source: undefined,
    });
  });

  it("searches description, note and tags, or tags only with a hash", () => {
    const row = { description: "Uber to work", note: null, tags: ["work", "travel"] };
    expect(matchesSearch(row, "uber")).toBe(true);
    expect(matchesSearch(row, "#trav")).toBe(true);
    expect(matchesSearch(row, "#uber")).toBe(false);
    expect(matchesSearch(row, "")).toBe(true);
  });
});
