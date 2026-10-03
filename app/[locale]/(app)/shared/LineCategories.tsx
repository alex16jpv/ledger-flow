"use client";

import { useTranslations } from "next-intl";

import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CoveredLine } from "@/features/shared/settle";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";

export interface LineCategoriesValue {
  categoryId: string | null;
  perLine: Record<string, string>;
}

export interface LineCategoriesProps {
  lines: CoveredLine[];
  value: LineCategoriesValue;
  onChange: (next: LineCategoriesValue) => void;
}

export const categoryOf = (value: LineCategoriesValue, line: CoveredLine): string | null =>
  value.perLine[line.expenseId] ?? value.categoryId;

export const missingCategory = (value: LineCategoriesValue, lines: readonly CoveredLine[]) =>
  lines.some((line) => !categoryOf(value, line));

export function LineCategories({ lines, value, onChange }: LineCategoriesProps) {
  const t = useTranslations("shared.settle");
  const money = useMoney();
  const dates = useDates();
  const [only] = lines;
  return (
    <div className="flex flex-col gap-3">
      <CategoryPicker
        type="EXPENSE"
        label={
          lines.length === 1 && only
            ? t("categoryFor", {
                amount: money.format(only.covered),
                description: only.description ?? t("noDescription"),
              })
            : t("category")
        }
        value={value.categoryId}
        allowCreate={false}
        onChange={(category) => {
          onChange({ categoryId: category.id, perLine: {} });
        }}
      />
      {lines.length > 1 &&
        lines.map((line) => (
          <CategoryPicker
            key={line.expenseId}
            type="EXPENSE"
            label={t("categoryForLine", {
              amount: money.format(line.covered),
              description: line.description ?? t("noDescription"),
              date: dates.formatDay(new Date(line.date)),
            })}
            value={categoryOf(value, line)}
            allowCreate={false}
            onChange={(category) => {
              onChange({ ...value, perLine: { ...value.perLine, [line.expenseId]: category.id } });
            }}
          />
        ))}
    </div>
  );
}
