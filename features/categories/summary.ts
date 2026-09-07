import type { Category } from "@/types/api";

import type { CategoryType } from "./api";

export function categoryType(category: Pick<Category, "type">): CategoryType {
  return category.type ?? "EXPENSE";
}

export function findActiveCategoryByName(
  categories: readonly Category[],
  name: string,
): Category | undefined {
  const needle = name.trim().toLocaleLowerCase();
  return categories.find(
    (category) => !category.archivedAt && category.name.trim().toLocaleLowerCase() === needle,
  );
}
