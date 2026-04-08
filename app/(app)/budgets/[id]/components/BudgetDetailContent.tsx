"use client";

import { useEffect, useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";
import { getCategories } from "@/services/categories.service";
import { Category } from "@/types/Category.types";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";
import BudgetHero from "./BudgetHero";
import BudgetInfo from "./BudgetInfo";
import BudgetTransactions from "./BudgetTransactions";

export default function BudgetDetailContent({ id }: { id: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getCategories({ limit: DEFAULT_LIST_LIMIT });
    if (result.error) {
      setError(result.error);
    } else {
      setCategories(result.data?.data ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const budget = MOCK_BUDGETS.find((b) => b.id === id);

  if (!budget) {
    notFound();
  }

  const category = categoryMap.get(budget.categoryId);
  const categoryEmoji = category?.emoji;
  const categoryName = category?.name;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
            <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
            <div className="h-12 w-full bg-stone-100 rounded" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-stone-100 rounded-xl p-6 animate-pulse">
            <div className="h-8 w-24 bg-stone-100 rounded mb-3" />
            <div className="h-16 w-full bg-stone-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <BudgetTransactions budget={budget} />

      <div className="flex flex-col gap-4">
        <BudgetHero budget={budget} categoryEmoji={categoryEmoji} />
        <BudgetInfo
          budget={budget}
          categoryName={categoryName}
          categoryEmoji={categoryEmoji}
        />
      </div>
    </div>
  );
}
