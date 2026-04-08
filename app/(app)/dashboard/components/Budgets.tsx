"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BudgetItem from "./BudgetItem";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";
import { getCategories } from "@/services/categories.service";
import { Category } from "@/types/Category.types";

export default function Budgets() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getCategories({ limit: "100" });
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
      <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-800">Monthly Budgets</h2>
        </div>
        <div className="px-5 py-4 animate-pulse flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-stone-100 rounded" />
          ))}
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
    <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">Monthly Budgets</h2>
        <Link
          href="/budgets"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          Manage →
        </Link>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {MOCK_BUDGETS.map((budget) => (
          <BudgetItem
            key={budget.id}
            budget={budget}
            categoryEmoji={categoryMap.get(budget.categoryId)?.emoji}
          />
        ))}
      </div>
    </div>
  );
}
