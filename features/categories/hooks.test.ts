import type { Category } from "@/types/api";

import { rankRecentCategories } from "./hooks";
import { categoryKeys } from "./keys";
import { CATEGORY_TYPES, categoryFormSchema } from "./schemas";

function category(id: string): Category {
  return {
    id,
    name: id,
    icon: null,
    color: null,
    type: "EXPENSE",
    userId: "u1",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("categories", () => {
  it("nests keys under the feature root", () => {
    expect(categoryKeys.list({ type: "EXPENSE" })).toEqual([
      "categories",
      "list",
      { type: "EXPENSE" },
    ]);
    expect(categoryKeys.usage({ type: "INCOME", from: "a", to: "b" })[0]).toBe("categories");
  });

  it("ranks recent categories by usage count and skips buckets without a listed category", () => {
    const listed = [category("food"), category("coffee"), category("bus"), category("gym")];
    const buckets = [
      { key: "food", total: 900, count: 4, avg: 225 },
      { key: "uncategorized", total: 5000, count: 9, avg: 555 },
      { key: "coffee", total: 100, count: 6, avg: 16 },
      { key: "archived", total: 700, count: 8, avg: 87 },
      { key: "bus", total: 300, count: 4, avg: 75 },
      { key: "gym", total: 50, count: 1, avg: 50 },
    ];
    expect(rankRecentCategories(buckets, listed).map((c) => c.id)).toEqual([
      "coffee",
      "food",
      "bus",
    ]);
  });

  it("validates the quick form with message keys", () => {
    expect(CATEGORY_TYPES).toHaveLength(3);
    const invalid = categoryFormSchema.safeParse({
      name: " ",
      icon: "utensils",
      color: "ORANGE",
      type: "EXPENSE",
    });
    expect(invalid.error?.issues[0]?.message).toBe("validation.required");
    expect(
      categoryFormSchema.safeParse({
        name: "Gym",
        icon: "dumbbell",
        color: "TEAL",
        type: "EXPENSE",
      }).success,
    ).toBe(true);
    expect(
      categoryFormSchema.safeParse({
        name: "Gym",
        icon: "not-an-icon",
        color: "TEAL",
        type: "EXPENSE",
      }).success,
    ).toBe(false);
  });
});
