import { transaction } from "@/lib/testing/vault";
import type { SyncTransaction } from "@/types/api";

import { buildSuggestIndex, fold, splitMatch, suggestDescriptions, suggestTags } from "./index";

let n = 0;
const row = (
  description: string | null,
  overrides: Partial<SyncTransaction> = {},
): SyncTransaction => {
  n += 1;
  return transaction({
    id: `t${n}`,
    description,
    date: `2026-08-${String(Math.min(n, 28)).padStart(2, "0")}T10:00:00.000Z`,
    ...overrides,
  });
};

beforeEach(() => {
  n = 0;
});

describe("fold", () => {
  it("drops case, accents and repeated spaces", () => {
    expect(fold("  Café  con LECHE ")).toBe("cafe con leche");
    expect(fold("Über")).toBe("uber");
  });
});

describe("suggestDescriptions", () => {
  it("matches the start of any word, without case or accents, and never offers what was typed", () => {
    const index = buildSuggestIndex([row("Café con leche"), row("Uber to work")]);
    const texts = (query: string) =>
      suggestDescriptions(index, "EXPENSE", query).map((s) => s.text);
    expect(texts("cafe")).toEqual(["Café con leche"]);
    expect(texts("CON")).toEqual(["Café con leche"]);
    expect(texts("lech")).toEqual(["Café con leche"]);
    expect(texts("afé")).toEqual([]);
    expect(texts("to w")).toEqual(["Uber to work"]);
    expect(texts("uber to work")).toEqual([]);
    expect(texts("")).toEqual([]);
    expect(texts("   ")).toEqual([]);
  });

  it("ranks by how often, then how recently, and the newest row names the text", () => {
    const index = buildSuggestIndex([
      row("uber to work", { date: "2026-08-01T10:00:00.000Z" }),
      row("Uber to work", { date: "2026-08-05T10:00:00.000Z" }),
      row("Uber home", { date: "2026-08-20T10:00:00.000Z" }),
      row("Uber to the airport", { date: "2026-08-02T10:00:00.000Z" }),
    ]);
    expect(suggestDescriptions(index, "EXPENSE", "ub")).toEqual([
      { text: "Uber to work", count: 2 },
      { text: "Uber home", count: 1 },
      { text: "Uber to the airport", count: 1 },
    ]);
  });

  it("scopes by type, ignores adjustments and settlements, and stops at the limit", () => {
    const index = buildSuggestIndex([
      row("Salary", { type: "INCOME" }),
      row("Savings", { type: "TRANSFER" }),
      row("Settled", { type: "SETTLEMENT" }),
      row("Set right", { type: "ADJUSTMENT" }),
      ...Array.from({ length: 7 }, (_, i) => row(`Snack ${i}`)),
    ]);
    expect(suggestDescriptions(index, "INCOME", "s").map((s) => s.text)).toEqual(["Salary"]);
    expect(suggestDescriptions(index, "TRANSFER", "s").map((s) => s.text)).toEqual(["Savings"]);
    expect(suggestDescriptions(index, "EXPENSE", "s")).toHaveLength(5);
    expect(suggestDescriptions(index, "EXPENSE", "set")).toEqual([]);
  });

  it("leaves the row being edited out of the counts", () => {
    const index = buildSuggestIndex([row("Uber to work"), row("Uber to work"), row("Uber home")]);
    const editing = {
      type: "EXPENSE" as const,
      description: "Uber home",
      tags: [],
      categoryId: null,
    };
    expect(suggestDescriptions(index, "EXPENSE", "ub", 5, editing)).toEqual([
      { text: "Uber to work", count: 2 },
    ]);
    const other = { ...editing, description: "Uber to work" };
    expect(suggestDescriptions(index, "EXPENSE", "ub", 5, other)).toEqual([
      { text: "Uber home", count: 1 },
      { text: "Uber to work", count: 1 },
    ]);
  });

  it("keeps only the newest rows once the cap is reached", () => {
    const rows = [row("First"), row("Second"), row("Third"), row("Fourth")];
    const index = buildSuggestIndex(rows, 3);
    expect(index.rows).toBe(3);
    expect(suggestDescriptions(index, "EXPENSE", "fo")).toEqual([]);
    expect(suggestDescriptions(index, "EXPENSE", "fi")).toHaveLength(1);
  });
});

describe("suggestTags", () => {
  const rows = () => [
    row("Uber to work", { categoryId: "transport", tags: ["work", "commute"] }),
    row("Uber to work", { categoryId: "transport", tags: ["work"] }),
    row("Latte", { categoryId: "coffee", tags: ["coffee", "work-trip"] }),
    row("Conference", { categoryId: "travel", tags: ["conference", "work-trip"] }),
    row("Lunch", { categoryId: "food", tags: ["coworkers"] }),
  ];
  const context = { categoryId: null, description: "", chosen: [] };

  it("matches at the start of the tag or after a hyphen, never anywhere else", () => {
    const index = buildSuggestIndex(rows());
    const tags = (query: string) => suggestTags(index, "EXPENSE", context, query).map((s) => s.tag);
    expect(tags("co")).toEqual(["coworkers", "conference", "coffee", "commute"]);
    expect(tags("trip")).toEqual(["work-trip"]);
    expect(tags("ork")).toEqual([]);
    expect(tags("")).toEqual([]);
  });

  it("puts the tags that go with this description and category first, then use, then recency", () => {
    const index = buildSuggestIndex(rows());
    const withUber = suggestTags(
      index,
      "EXPENSE",
      { categoryId: "transport", description: "uber to work", chosen: [] },
      "w",
    );
    expect(withUber.map((s) => s.tag)).toEqual(["work", "work-trip"]);
    expect(withUber[0]).toEqual({ tag: "work", count: 2, categoryId: "transport" });
    const withCoffee = suggestTags(
      index,
      "EXPENSE",
      { categoryId: "coffee", description: "", chosen: [] },
      "w",
    );
    expect(withCoffee.map((s) => s.tag)).toEqual(["work-trip", "work"]);
    const plain = suggestTags(index, "EXPENSE", context, "c");
    expect(plain.map((s) => s.tag)).toEqual(["coworkers", "conference", "coffee", "commute"]);
  });

  it("offers neither a tag already on the field nor the one typed in full", () => {
    const index = buildSuggestIndex(rows());
    expect(
      suggestTags(index, "EXPENSE", { ...context, chosen: ["work"] }, "wor").map((s) => s.tag),
    ).toEqual(["work-trip"]);
    expect(suggestTags(index, "EXPENSE", context, "work").map((s) => s.tag)).toEqual(["work-trip"]);
  });

  it("leaves the row being edited out of the counts and the co-occurrence", () => {
    const index = buildSuggestIndex(rows());
    const editing = {
      type: "EXPENSE" as const,
      description: "Latte",
      tags: ["coffee", "work-trip"],
      categoryId: "coffee",
    };
    expect(suggestTags(index, "EXPENSE", context, "cof", 5, editing)).toEqual([]);
    expect(suggestTags(index, "EXPENSE", context, "trip", 5, editing)).toEqual([
      { tag: "work-trip", count: 1, categoryId: "travel" },
    ]);
  });
});

describe("splitMatch", () => {
  it("returns the typed span over the original text, accents and case kept", () => {
    expect(splitMatch("Café con leche", "cafe")).toEqual({
      before: "",
      match: "Café",
      after: " con leche",
    });
    expect(splitMatch("Café con leche", "LECH")).toEqual({
      before: "Café con ",
      match: "lech",
      after: "e",
    });
    expect(splitMatch("Uber to work", "to w")).toEqual({
      before: "Uber ",
      match: "to w",
      after: "ork",
    });
    expect(splitMatch("Uber to work", "ork")).toBeNull();
    expect(splitMatch("Uber to work", "")).toBeNull();
  });
});

describe("the cost", () => {
  it("indexes fifty thousand rows and answers a keystroke in the order of magnitude the plan set", () => {
    const words = [
      "uber",
      "latte",
      "lunch",
      "bus",
      "rent",
      "gym",
      "pharmacy",
      "market",
      "taxi",
      "coffee",
    ];
    const rows = Array.from({ length: 50_000 }, (_, i) =>
      transaction({
        id: `r${i}`,
        description: `${words[i % 10]} ${words[(i * 7) % 10]} ${i % 500}`,
        tags: [words[i % 10] ?? "x", `${words[(i * 3) % 10]}-trip`],
        date: `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const started = performance.now();
    const index = buildSuggestIndex(rows, 50_000);
    const built = performance.now() - started;
    const lookupStarted = performance.now();
    for (let i = 0; i < 1_000; i += 1) suggestDescriptions(index, "EXPENSE", "lu");
    const lookup = (performance.now() - lookupStarted) / 1_000;
    expect(index.rows).toBe(50_000);
    expect(built).toBeLessThan(2_000);
    expect(lookup).toBeLessThan(2);
  });
});
