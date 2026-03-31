"use client";

import { useEffect, useState, useCallback } from "react";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";
import { getCategories } from "@/services/categories.service";
import { Category } from "@/types/Category.types";
import { DEFAULT_LIST_LIMIT } from "@/utils/constants";
import BudgetSummary from "./BudgetSummary";
import BudgetCard from "./BudgetCard";
import BudgetAlerts from "./BudgetAlerts";

export default function BudgetsPageContent() {
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-stone-100 rounded-xl p-5 h-28 animate-pulse"
            >
              <div className="h-3 w-20 bg-stone-100 rounded mb-3" />
              <div className="h-8 w-24 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-stone-100 rounded-xl p-5 h-36 animate-pulse"
              >
                <div className="h-3 w-16 bg-stone-100 rounded mb-3" />
                <div className="h-6 w-32 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={fetchCategories}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <BudgetSummary budgets={MOCK_BUDGETS} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MOCK_BUDGETS.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                categoryEmoji={categoryMap.get(budget.categoryId)?.emoji}
              />
            ))}
          </div>
        </div>

        <BudgetAlerts budgets={MOCK_BUDGETS} />
      </div>
    </>
  );
}
