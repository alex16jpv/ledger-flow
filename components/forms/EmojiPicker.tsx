"use client";

import { useState } from "react";
import FieldError from "./FieldError";

const EMOJI_GROUPS = [
  {
    name: "Finance",
    icon: "💰",
    emojis: [
      "💼", "💰", "💵", "💳", "🏦", "📈", "📊", "💲", "🧾", "📋",
      "🎁", "🔄", "➕", "🔁", "💸",
    ],
  },
  {
    name: "Home",
    icon: "🏠",
    emojis: [
      "🏠", "⚡", "🛋️", "🔧", "🧹", "🏡", "🔑", "🛏️", "🪴", "🧊",
    ],
  },
  {
    name: "Food",
    icon: "🍽️",
    emojis: [
      "🍔", "🍕", "☕", "🍽️", "🛒", "🍺", "🍷", "🥗", "🍳", "🍰",
      "🍜", "🥤", "🍣", "🧁", "🥑", "🫕",
    ],
  },
  {
    name: "Transport",
    icon: "🚗",
    emojis: [
      "🚗", "🚌", "⛽", "✈️", "🚇", "🚲", "🛵", "🚕", "🚢", "🏍️",
      "🛻", "🚁",
    ],
  },
  {
    name: "Health",
    icon: "🏥",
    emojis: [
      "🏥", "💊", "🏋️", "🧘", "💇", "🏃", "🩺", "💪", "🧑‍⚕️", "🦷",
    ],
  },
  {
    name: "Fun",
    icon: "🎬",
    emojis: [
      "🎬", "🎮", "🎵", "📺", "🎨", "🎪", "🎯", "🎭", "🎲", "📱",
      "🎤", "🎻",
    ],
  },
  {
    name: "Shopping",
    icon: "🛍️",
    emojis: [
      "🛍️", "👕", "👟", "💄", "💻", "⌚", "📷", "🎧", "👗", "🧢",
      "💍", "🕶️",
    ],
  },
  {
    name: "Education",
    icon: "📚",
    emojis: [
      "📚", "🎓", "✏️", "📝", "🔬", "🧑‍💻", "📖", "🎒", "🧪", "🗞️",
    ],
  },
  {
    name: "People",
    icon: "❤️",
    emojis: [
      "👶", "🐶", "🐱", "❤️", "🎉", "🧸", "🤝", "👨‍👩‍👧", "🎂", "🫶",
    ],
  },
  {
    name: "Travel",
    icon: "🌍",
    emojis: [
      "🌍", "🏖️", "⛰️", "🌿", "🌞", "🏔️", "🌊", "🌺", "🗺️", "⛺",
    ],
  },
  {
    name: "Other",
    icon: "📦",
    emojis: [
      "📦", "⭐", "🔔", "🏷️", "📌", "🗂️", "✅", "🛡️", "🔒", "💡",
      "🎗️", "🪙",
    ],
  },
];

export default function EmojiPicker({
  selectedEmoji,
  onEmojiChange,
  error,
}: {
  selectedEmoji: string;
  onEmojiChange: (emoji: string) => void;
  error?: string;
}) {
  const [activeGroup, setActiveGroup] = useState(0);

  return (
    <div>
      <label className="field-label">Icon</label>

      {/* Group tabs */}
      <div className="flex border-b border-stone-100 mb-3 overflow-x-auto scrollbar-hide">
        {EMOJI_GROUPS.map((group, i) => (
          <button
            key={group.name}
            type="button"
            onClick={() => setActiveGroup(i)}
            className={`
              px-2 py-2 text-base shrink-0 transition-colors border-b-2 cursor-pointer
              ${activeGroup === i
                ? "border-teal-400"
                : "border-transparent hover:bg-stone-50"
              }
            `}
            title={group.name}
          >
            {group.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-2">
        {EMOJI_GROUPS[activeGroup].name}
      </p>
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onEmojiChange(emoji)}
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center text-xl
              transition-colors cursor-pointer
              ${selectedEmoji === emoji
                ? "bg-teal-50 ring-2 ring-teal-400"
                : "hover:bg-stone-50"
              }
            `}
          >
            {emoji}
          </button>
        ))}
      </div>

      <FieldError message={error} />
    </div>
  );
}
