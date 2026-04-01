import Link from "next/link";
import type { Category } from "@/types/Category.types";
import { CATEGORY_COLOR_STYLES } from "@/utils/constants";

export default function CategoryCard({
  category,
  onDelete,
}: {
  category: Category;
  onDelete: (id: string) => void;
}) {
  const color = category.color && category.color in CATEGORY_COLOR_STYLES
    ? CATEGORY_COLOR_STYLES[category.color]
    : CATEGORY_COLOR_STYLES.GRAY;

  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5 flex items-center gap-4 hover:border-stone-200 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center text-lg shrink-0`}>
        {category.emoji ?? "📦"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">{category.name}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/categories/${category.id}/edit`}
          className="text-xs text-teal-600 hover:text-teal-800 transition-colors px-2 py-1"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(category.id)}
          className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
