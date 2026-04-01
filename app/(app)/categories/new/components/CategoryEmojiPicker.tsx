import EmojiPicker from "@/components/forms/EmojiPicker";

/**
 * @deprecated Use `EmojiPicker` from `@/components/forms/EmojiPicker` directly.
 */
export default function CategoryEmojiPicker({
  selectedEmoji,
  onEmojiChange,
}: {
  selectedEmoji: string;
  onEmojiChange: (emoji: string) => void;
}) {
  return (
    <EmojiPicker
      selectedEmoji={selectedEmoji}
      onEmojiChange={onEmojiChange}
    />
  );
}
