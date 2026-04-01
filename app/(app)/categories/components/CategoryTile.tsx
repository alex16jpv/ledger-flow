import Link from "next/link";
import type { Category } from "@/types/Category.types";
import { CATEGORY_COLOR_STYLES } from "@/utils/constants";

export default function CategoryTile({
  category,
  onDelete,
}: {
  category: Category;
  onDelete: (id: string) => void;
}) {
  const color =
    category.color && category.color in CATEGORY_COLOR_STYLES
      ? CATEGORY_COLOR_STYLES[category.color]
      : CATEGORY_COLOR_STYLES.GRAY;

  return (
    <div className={`group relative ${color.bg} border border-stone-100 rounded-xl p-4 hover:border-stone-200 transition-colors`}>
      <Link
        href={`/categories/${category.id}`}
        className="flex items-center gap-3 min-w-0"
      >
        <span className="text-xl shrink-0">{category.emoji ?? "📦"}</span>
        <span className="text-sm font-medium text-stone-700 truncate">
          {category.name}
        </span>
      </Link>

      {/* Actions on hover */}
      <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-0.5">
        <Link
          href={`/categories/${category.id}/edit`}
          className="text-xs text-teal-600 hover:text-teal-800 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
          title="Edit"
        >
          ✏️
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(category.id);
          }}
          className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
