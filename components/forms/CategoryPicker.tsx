"use client";

import { useState } from "react";
import FieldError from "./FieldError";
import type { Category } from "@/types/Category.types";
import { CATEGORY_COLOR_STYLES } from "@/utils/constants";

function getCategoryColorStyle(category: Category) {
  if (category.color && category.color in CATEGORY_COLOR_STYLES) {
    return CATEGORY_COLOR_STYLES[category.color];
  }
  return CATEGORY_COLOR_STYLES.GRAY;
}

export default function CategoryPicker({
  categories,
  selectedId,
  onChange,
  error,
}: {
  categories: Category[];
  selectedId?: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : categories;

  return (
    <div>
      <label className="field-label">Category</label>

      {categories.length > 8 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="input-base mb-3 text-sm"
        />
      )}

      <div className="max-h-52 overflow-y-auto rounded-lg">
        <div className="flex flex-wrap gap-2">
          {filtered.map((cat) => {
            const isSelected = selectedId === cat.id;
            const color = getCategoryColorStyle(cat);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onChange(isSelected ? "" : cat.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl border text-sm
                  transition-all cursor-pointer
                  ${isSelected
                    ? `${color.bg} ${color.border} ring-2 ${color.ring} font-medium`
                    : "bg-white border-stone-100 hover:border-stone-200 hover:bg-stone-50"
                  }
                `}
                aria-pressed={isSelected}
              >
                <span className={`w-2 h-2 rounded-full ${color.dot} shrink-0`} />
                <span className="text-base leading-none">
                  {cat.emoji ?? "📦"}
                </span>
                <span className={isSelected ? "text-stone-800" : "text-stone-600"}>
                  {cat.name}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-stone-400 py-2">No categories found</p>
          )}
        </div>
      </div>

      <FieldError message={error} />
    </div>
  );
}
