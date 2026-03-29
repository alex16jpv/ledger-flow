const EMOJI_OPTIONS = [
  { emoji: "🍔", label: "Food" },
  { emoji: "🚌", label: "Transport" },
  { emoji: "🏠", label: "Home" },
  { emoji: "🎬", label: "Entertain" },
  { emoji: "💊", label: "Health" },
  { emoji: "🛒", label: "Shopping" },
  { emoji: "✈️", label: "Travel" },
  { emoji: "📦", label: "Other" },
];

export default function EmojiPicker({
  selectedEmoji,
  onEmojiChange,
}: {
  selectedEmoji: string;
  onEmojiChange: (emoji: string) => void;
}) {
  return (
    <div>
      <span className="field-label">Category Icon</span>
      <div className="flex gap-2 flex-wrap">
        {EMOJI_OPTIONS.map((opt) => {
          const isSelected = selectedEmoji === opt.emoji;
          return (
            <button
              key={opt.emoji}
              type="button"
              onClick={() => onEmojiChange(opt.emoji)}
              className={`cat-chip ${isSelected ? "selected" : ""}`}
              aria-label={opt.label}
              aria-pressed={isSelected}
            >
              <span className="cat-emoji">{opt.emoji}</span>
              <span className="cat-name">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
