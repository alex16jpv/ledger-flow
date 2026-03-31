"use client";

import { useState, useEffect, useCallback } from "react";
import type { Category } from "@/types/Category.types";
import { getCategories, deleteCategory } from "@/services/categories.service";
import CategoryCard from "./CategoryCard";

export default function CategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getCategories();
    if (result.error) {
      setError(result.error);
    } else if (result.data?.data) {
      setCategories(result.data.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleDelete = async (id: string) => {
    const result = await deleteCategory(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-stone-100 rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-100 rounded-xl" />
              <div className="h-4 w-32 bg-stone-100 rounded" />
            </div>
          </div>
        ))}
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

  if (categories.length === 0) {
    return (
      <div className="bg-white border border-stone-100 rounded-xl p-8 text-center">
        <p className="text-2xl mb-2">📂</p>
        <p className="text-sm text-stone-500 mb-1">No categories yet</p>
        <p className="text-xs text-stone-400">
          Create your first category to organize transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
