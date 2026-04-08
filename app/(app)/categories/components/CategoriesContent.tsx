"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Category } from "@/types/Category.types";
import { getCategories, deleteCategory } from "@/services/categories.service";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_COLORS,
  DEFAULT_LIST_LIMIT,
} from "@/utils/constants";
import type { TransactionKind } from "@/utils/constants";
import CategoryTile from "./CategoryTile";

const TYPE_ORDER: TransactionKind[] = ["EXPENSE", "INCOME", "TRANSFER"];

export default function CategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    const result = await deleteCategory(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((category) =>
      category.name.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const type of TYPE_ORDER) {
      map.set(type, []);
    }
    for (const cat of filtered) {
      const key = cat.type ?? "EXPENSE";
      const list = map.get(key);
      if (list) list.push(cat);
      else map.set(key, [cat]);
    }
    return map;
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i}>
            <div className="h-5 w-24 bg-stone-100 rounded mb-3 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="bg-white border border-stone-100 rounded-xl p-4 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-stone-100 rounded-lg" />
                    <div className="h-4 w-16 bg-stone-100 rounded" />
                  </div>
                </div>
              ))}
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
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-colors"
        />
      </div>

      {/* Grouped sections */}
      {TYPE_ORDER.map((type) => {
        const items = grouped.get(type);
        if (!items || items.length === 0) return null;

        const collapsed = collapsedGroups.has(type);
        const colors = TRANSACTION_TYPE_COLORS[type];
        const label = TRANSACTION_TYPE_LABELS[type];

        return (
          <section key={type}>
            <button
              type="button"
              onClick={() => toggleGroup(type)}
              className="flex items-center gap-2 mb-3 group w-full text-left"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${colors.textColor.replace("text-", "bg-")}`}
              />
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                {label}
              </h2>
              <span className="text-[10px] text-stone-400 font-normal">
                ({items.length})
              </span>
              <span className="text-stone-300 text-xs ml-auto transition-transform group-hover:text-stone-500">
                {collapsed ? "▸" : "▾"}
              </span>
            </button>

            {!collapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((category) => (
                  <CategoryTile
                    key={category.id}
                    category={category}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-white border border-stone-100 rounded-xl p-6 text-center">
          <p className="text-sm text-stone-500">
            No categories match &ldquo;{search}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
