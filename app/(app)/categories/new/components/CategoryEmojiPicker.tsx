import { CATEGORY_EMOJI_OPTIONS } from "@/lib/schemas/category.schema";

export default function CategoryEmojiPicker({
  selectedEmoji,
  onEmojiChange,
}: {
  selectedEmoji: string;
  onEmojiChange: (emoji: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORY_EMOJI_OPTIONS.map((opt) => {
        const isSelected = selectedEmoji === opt.emoji;
        return (
          <button
            key={opt.emoji}
            type="button"
            onClick={() => onEmojiChange(opt.emoji)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-colors ${
              isSelected
                ? "border-teal-400 bg-teal-50 text-teal-800"
                : "border-stone-100 bg-white text-stone-600 hover:border-stone-200"
            }`}
            aria-label={opt.label}
            aria-pressed={isSelected}
          >
            <span className="text-lg">{opt.emoji}</span>
            <span className="text-[10px] font-mono">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
